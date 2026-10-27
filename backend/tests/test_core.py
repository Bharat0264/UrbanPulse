import os
from datetime import datetime
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.schemas.models import Filters
from backend.app.services import analytics as a
from backend.ml.train import features, FEATURES
from backend.pipelines.process import clean, session

@pytest.fixture(scope='module')
def spark():
    s=session(2); s.sparkContext.setLogLevel('ERROR'); yield s; s.stop()

def test_cleaning_and_aggregation(spark):
    rows=[('2024-01-01 10:00:00','2024-01-01 10:15:00',161,162,2.,10.),
          ('2024-01-01 11:00:00','2024-01-01 11:20:00',161,162,3.,20.),
          ('2024-01-01 11:00:00','2024-01-01 10:20:00',161,162,3.,20.),
          ('2024-01-01 11:00:00','2024-01-01 11:20:00',999,162,3.,20.),
          ('2024-01-01 11:00:00','2024-01-01 11:20:00',161,162,-3.,20.),
          ('2023-12-01 11:00:00','2023-12-01 11:20:00',161,162,3.,20.),
          (None,'2024-01-01 11:20:00',161,162,3.,20.)]
    df=spark.createDataFrame(rows,['tpep_pickup_datetime','tpep_dropoff_datetime','PULocationID','DOLocationID','trip_distance','fare_amount'])
    cleaned=clean(df,[161,162],['2024-01'])
    assert cleaned.count()==2
    assert cleaned.groupBy('PULocationID').sum('fare_amount').first()[1]==30
    assert cleaned.agg({'duration':'avg'}).first()[0]==17.5

def test_features_cannot_see_current_or_future_target():
    s=pd.Series(np.arange(100,dtype=float),index=pd.date_range('2024-01-01',periods=100,freq='h'))
    before=features(s,161)
    changed=s.copy(); changed.iloc[60:]=999999
    after=features(changed,161)
    pd.testing.assert_frame_equal(before[FEATURES].iloc[:61],after[FEATURES].iloc[:61])
    assert before.lag24.iloc[60]==36
    assert before.mean24.iloc[60]==np.mean(np.arange(36,60))

def test_filter_validation():
    with pytest.raises(ValueError): Filters(start='2024-02-02',end='2024-01-01')
    with pytest.raises(ValueError): Filters(hour_start=20,hour_end=10)
    with pytest.raises(ValueError): Filters(zone=999)

def test_parameterized_filter_semantics(monkeypatch):
    monkeypatch.setattr(a,'zones',lambda:{161:{'Borough':'Manhattan'}})
    w,p=a.where(Filters(zone=161,borough='Manhattan',direction='dropoff',day_type='weekend',hour_start=17,hour_end=20))
    assert 'DOLocationID = ?' in w and 'IN (6,7)' in w
    assert p==[17,20,161,[161]]

def test_anomaly_uses_only_prior_matching_hours(monkeypatch):
    times=pd.date_range('2024-01-01',periods=5,freq='7D')
    rows=[{'time':t.to_pydatetime(),'zone':161,'trips':v} for t,v in zip(times,[10,10,10,30,10])]
    monkeypatch.setattr(a,'query',lambda *args,**kwargs:rows)
    monkeypatch.setattr(a,'zones',lambda:{161:{'Zone':'Midtown'}})
    results=a.anomalies(Filters())
    assert len(results)==1 and results[0]['expected']==10 and results[0]['score']==20

def test_api_health_and_validation():
    client=TestClient(app)
    assert client.get('/api/health').json()['status']=='ok'
    assert client.get('/api/forecast?zone=999').status_code==422
    assert client.get('/api/dashboard/overview?hour_start=24').status_code==422
    assert client.get('/api/analytics/invalid').status_code==422

def test_integration_real_dataset():
    if not (a.DATA/'metadata.json').exists(): pytest.skip('Run Spark pipeline first')
    client=TestClient(app)
    total=client.get('/api/dashboard/overview'); assert total.status_code==200
    d=total.json(); assert d['trips']==a.metadata()['cleaned_rows']
    hourly=client.get('/api/analytics/hourly-demand').json()['rows']
    assert sum(r['trips'] for r in hourly)==d['trips']
    filtered=client.get('/api/dashboard/overview?zone=161').json()
    assert 0<filtered['trips']<=d['trips']
    assert client.get('/api/export/pdf?zone=161').content.startswith(b'%PDF')
    assert 'trips' in client.get('/api/export/csv').text
    assert client.get('/api/geo/taxi-zones').json()['type']=='FeatureCollection'

def test_forecast_artifact_integration():
    from backend.app.services.config import MODELS
    if not (MODELS/'metadata.json').exists(): pytest.skip('Train model first')
    client=TestClient(app)
    m=client.get('/api/model/metrics').json()
    assert m['train_end']<m['validation_end']<m['test_end']
    assert m['test']['mae']>=0 and m['baseline_test']['rmse']>=0
    p=client.get('/api/forecast?zone=161'); assert p.status_code==200
    assert p.json()['prediction']>=0
    assert p.json()['recent'][-1]['time']<p.json()['timestamp']
