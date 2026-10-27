"""Chronological, zone-hour demand forecasting with shifted historical features."""
import json
from datetime import datetime
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from backend.app.services.analytics import query, metadata
from backend.app.services.config import MODELS
FEATURES=['hour','weekday','month','weekend','zone','lag1','lag24','mean24','std24']

def features(series, zone):
    frame=pd.DataFrame({'actual':series})
    frame['hour']=frame.index.hour; frame['weekday']=frame.index.dayofweek
    frame['month']=frame.index.month; frame['weekend']=(frame.index.dayofweek>=5).astype(int)
    frame['zone']=zone
    frame['lag1']=series.shift(1); frame['lag24']=series.shift(24)
    frame['mean24']=series.shift(1).rolling(24).mean()
    frame['std24']=series.shift(1).rolling(24).std()
    return frame

def dense_series():
    rows=pd.DataFrame(query('SELECT time, PULocationID AS zone, trips FROM facts ORDER BY time',table='zone_hour'))
    rows['time']=pd.to_datetime(rows.time)
    meta=metadata()
    # Complete month hours, but only include hours within observed dataset coverage.
    index=pd.date_range(meta['start'],meta['end'],freq='h')
    return {int(zone):g.set_index('time').trips.reindex(index,fill_value=0).astype(float) for zone,g in rows.groupby('zone')}

def train():
    meta=metadata(); series=dense_series()
    data=pd.concat([features(s,z) for z,s in series.items()]).dropna().sort_index()
    times=data.index.unique().sort_values()
    if len(times)<96:
        raise ValueError('Need at least five days of historical data')
    cut1=times[int(len(times)*.7)]; cut2=times[int(len(times)*.85)]
    train=data[data.index<cut1]; val=data[(data.index>=cut1)&(data.index<cut2)]; test=data[data.index>=cut2]
    candidates=[]
    for depth in [12,20]:
        model=RandomForestRegressor(n_estimators=60,max_depth=depth,min_samples_leaf=3,n_jobs=2,random_state=42)
        model.fit(train[FEATURES],train.actual)
        candidates.append((mean_absolute_error(val.actual,model.predict(val[FEATURES])),model))
    score,model=min(candidates,key=lambda item:item[0])
    predicted=model.predict(test[FEATURES]); baseline=test.lag24.to_numpy()
    def metrics(a,b): return {'mae':float(mean_absolute_error(a,b)),'rmse':float(np.sqrt(mean_squared_error(a,b)))}
    evaluation=test[['actual','zone','lag24']].copy(); evaluation['predicted']=predicted
    evaluation.reset_index(names='time').to_parquet(MODELS/'evaluation.parquet',index=False)
    info={'dataset_id':meta['dataset_id'],'mode':meta['mode'],'trained_at':datetime.now().isoformat(),
          'model':'Random Forest Regressor','baseline':'Previous-day same-hour demand',
          'test':metrics(test.actual,predicted),'baseline_test':metrics(test.actual,baseline),'validation_mae':float(score),
          'train_rows':len(train),'validation_rows':len(val),'test_rows':len(test),'train_end':str(cut1),
          'validation_end':str(cut2),'test_end':str(times[-1]),'features':FEATURES,
          'evaluation':'Rolling one-step evaluation; historical observations become available each hour. 70/15/15 chronological split. Depth selected on validation only.',
          'timezone':'America/New_York; TLC local wall-clock hours; DST ambiguity is not resolved'}
    joblib.dump({'model':model,'series':series,'dataset_id':meta['dataset_id']},MODELS/'forecast.joblib')
    (MODELS/'metadata.json').write_text(json.dumps(info,indent=2))
    print(json.dumps(info,indent=2))

if __name__=='__main__':
    MODELS.mkdir(exist_ok=True)
    train()
