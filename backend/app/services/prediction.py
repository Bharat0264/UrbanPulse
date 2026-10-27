import json
from functools import lru_cache
import joblib
import pandas as pd
from backend.app.services.config import MODELS
from backend.app.services.analytics import metadata
from backend.ml.train import features, FEATURES

@lru_cache(maxsize=2)
def artifact(modified):
    return joblib.load(MODELS/'forecast.joblib')

def predict(zone):
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
