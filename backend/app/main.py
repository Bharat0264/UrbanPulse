import csv
import io
import json
from typing import Literal
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import ValidationError
from reportlab.pdfgen import canvas
from backend.app.schemas.models import Filters, TableResponse, Overview, ForecastResponse, DatasetMetadata
from backend.app.services import analytics as a
from backend.app.services.config import ROOT, DATA, MODELS, ORIGIN
from backend.app.services.prediction import predict

app=FastAPI(title='UrbanPulse API',version='1.0.0')
app.add_middleware(CORSMiddleware,allow_origins=[ORIGIN],allow_methods=['GET'],allow_headers=['*'])

@app.exception_handler(FileNotFoundError)
async def missing(request,exc):
    return JSONResponse(status_code=503,content={'detail':'Dataset or model is not ready. Run ingestion, Spark processing, and model training. See README.'})

@app.exception_handler(ValueError)
async def invalid(request,exc):
    return JSONResponse(status_code=422,content={'detail':str(exc)})

@app.get('/api/health')
def health():
    return {'status':'ok','dataset_ready':(DATA/'metadata.json').exists(),'model_ready':(MODELS/'metadata.json').exists()}

@app.get('/api/dataset/metadata',response_model=DatasetMetadata)
@app.get('/api/spark/metrics',response_model=DatasetMetadata)
def metadata(): return a.metadata()

@app.get('/api/dashboard/overview',response_model=Overview)
def overview(f:Filters=Depends()): return a.overview(f)

@app.get('/api/analytics/fare-distance')
def distributions(f:Filters=Depends()): return {'distributions':a.distributions(f),'filters':f}

@app.get('/api/analytics/anomalies',response_model=TableResponse)
def anomalies(f:Filters=Depends()):
    return {'rows':a.anomalies(f),'filters':f,'units':'trips; robust z-score (3.5 threshold, at least 3 prior matching weekday-hours)'}

@app.get('/api/analytics/zone-details')
def details(f:Filters=Depends()):
    if not f.zone: raise HTTPException(422,'Select a zone')
    return a.overview(f)

@app.get('/api/analytics/{kind}',response_model=TableResponse)
def analytics(kind:Literal['hourly-demand','daily-demand','zones','origin-destination','landscape','weekdays'],f:Filters=Depends()):
    return {'rows':a.table(kind,f),'filters':f,'units':'trips (fare in USD)'}

@app.get('/api/geo/taxi-zones')
def geography(): return json.loads((ROOT/'data/raw/taxi-zones.geojson').read_text())

@app.get('/api/zones')
def zones(): return [{'id':k,'name':v['Zone'],'borough':v['Borough']} for k,v in a.zones().items() if k<=263]

@app.get('/api/forecast',response_model=ForecastResponse)
def forecast(zone:int=Query(...,ge=1,le=263)): return predict(zone)

@app.get('/api/model/metrics')
def model_metrics():
    info=json.loads((MODELS/'metadata.json').read_text())
    if info['dataset_id']!=a.metadata()['dataset_id']: raise HTTPException(409,'Model needs retraining after dataset change')
    return info

@app.get('/api/spark/benchmarks')
def benchmarks():
    path=DATA/'benchmarks.json'
    return json.loads(path.read_text()) if path.exists() else {'results':[],'methodology':'No benchmarks collected. Run python -m backend.pipelines.benchmark.'}

@app.get('/api/export/csv')
def export_csv(kind:Literal['hourly-demand','daily-demand','zones','origin-destination']='daily-demand',f:Filters=Depends()):
    rows=a.table(kind,f); output=io.StringIO()
    if rows:
        writer=csv.DictWriter(output,fieldnames=rows[0].keys()); writer.writeheader(); writer.writerows(rows)
    return Response(output.getvalue(),media_type='text/csv',headers={'Content-Disposition':f'attachment; filename="urbanpulse-{kind}.csv"'})

@app.get('/api/export/pdf')
def export_pdf(f:Filters=Depends()):
    info=a.metadata(); summary=a.overview(f)
    buffer=io.BytesIO(); doc=canvas.Canvas(buffer)
    doc.setTitle('UrbanPulse analytical summary')
    doc.setFont('Helvetica-Bold',24); doc.drawString(45,790,'UrbanPulse / Intelligence report')
    lines=[f"Source: {info['source']} | mode: {info['mode']}",f"Dataset coverage: {info['start']} to {info['end']}",
           'Time zone: America/New_York (local wall-clock time)',
           *[f'Filter {k}: {v}' for k,v in f.model_dump().items() if v is not None],
           f"Trips: {summary['trips']:,}",f"Reported fares: USD {summary['fares']:,.2f}",
           f"Average distance: {summary['distance']:.2f} miles",f"Average duration: {summary['duration']:.2f} minutes",
           f"Top zone: {summary['top_zone']}",'Flows describe zone-centroid connections, not observed road trajectories.']
    if (MODELS/'metadata.json').exists():
        m=json.loads((MODELS/'metadata.json').read_text())
        if m['dataset_id']==info['dataset_id']:
            lines.extend(['Model evaluation (whole held-out dataset; not filtered report period):',f"Random Forest MAE {m['test']['mae']:.2f}, RMSE {m['test']['rmse']:.2f}",f"Baseline MAE {m['baseline_test']['mae']:.2f}, RMSE {m['baseline_test']['rmse']:.2f}"])
    doc.setFont('Helvetica',10)
    for i,line in enumerate(lines): doc.drawString(45,750-i*20,line)
    doc.save()
    return Response(buffer.getvalue(),media_type='application/pdf',headers={'Content-Disposition':'attachment; filename="urbanpulse-report.pdf"'})
