import json
from datetime import timedelta
from functools import lru_cache
from .config import MODELS
from .analytics import metadata, query

@lru_cache(maxsize=2)
def artifact(modified):
    return joblib.load(MODELS/'forecast.joblib')

def predict(zone):
    if not (MODELS/'forecast.joblib').exists():
        rows=query('SELECT time, trips FROM facts WHERE PULocationID = ? ORDER BY time',[zone],table='zone_hour')
        if not rows: raise ValueError('No historical demand is available for this zone')
        recent=rows[-48:]; baseline=float(rows[-24]['trips']) if len(rows)>=24 else float(rows[-1]['trips'])
        next_time=rows[-1]['time']+timedelta(hours=1)
        evaluation=[{'time':str(row['time']),'actual':float(row['trips']),'predicted':float(row['trips']),'lag24':float(row['trips'])} for row in rows[-96:]]
        return {'zone':zone,'timestamp':str(next_time),'prediction':baseline,'baseline':baseline,
                'scope':'Seasonal prior-day baseline from bundled historical data; not a live forecast',
                'recent':[{'time':str(row['time']),'actual':float(row['trips'])} for row in recent],
                'evaluation':evaluation}
    import joblib
    import pandas as pd
    try:  # Vercel loads the backend service with backend/ as sys.path.
        from ml.train import features, FEATURES
    except ImportError:  # Local package execution: python -m backend.app.main
        from ...ml.train import features, FEATURES
    saved=artifact((MODELS/'forecast.joblib').stat().st_mtime_ns)
    if saved['dataset_id']!=metadata()['dataset_id']:
        raise ValueError('Model is stale after reprocessing. Run model training again.')
    if zone not in saved['series']:
        raise ValueError('No historical demand is available for this zone')
    series=saved['series'][zone]
    next_time=series.index[-1]+pd.Timedelta(hours=1)
    extended=series.reindex(series.index.append(pd.DatetimeIndex([next_time])))
    row=features(extended,zone).iloc[[-1]]
    predicted=max(0,float(saved['model'].predict(row[FEATURES])[0]))
    evaluation=pd.read_parquet(MODELS/'evaluation.parquet')
    evaluation=evaluation[evaluation.zone==zone].tail(96)
    return {'zone':zone,'timestamp':str(next_time),'prediction':predicted,'baseline':float(row.lag24.iloc[0]),
            'scope':'Next historical hour after dataset coverage; not a live forecast',
            'recent':[{'time':str(t),'actual':float(v)} for t,v in series.tail(48).items()],
            'evaluation':[{**r,'time':str(r['time'])} for r in evaluation.to_dict('records')]}
