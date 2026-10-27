import csv
import json
from functools import lru_cache
import duckdb
import numpy as np
from backend.app.services.config import ROOT, DATA
from backend.app.schemas.models import Filters

@lru_cache(maxsize=1)
def zones():
    with (ROOT/'data/raw/taxi_zone_lookup.csv').open() as f:
        return {int(r['LocationID']):r for r in csv.DictReader(f)}

def metadata():
    return json.loads((DATA/'metadata.json').read_text())

def query(sql, parameters=None, table='cube'):
    # Table is an internal allowlisted choice, never a request parameter.
    if table not in ('cube','hist','zone_hour'):
        raise ValueError('Unknown table')
    if not (DATA/table).exists():
        raise FileNotFoundError('Run Spark processing before querying analytics')
    with duckdb.connect() as con:
        con.execute('SET threads=2')
        con.read_parquet(str(DATA/table/'**/*.parquet'),hive_partitioning=True).create_view('facts')
        result=con.execute(sql,parameters or [])
        names=[c[0] for c in result.description]
        return [dict(zip(names,row)) for row in result.fetchall()]

def where(f):
    clauses=['extract(hour from time) BETWEEN ? AND ?']; params=[f.hour_start,f.hour_end]
    if f.start:
        clauses.append('CAST(time AS DATE) >= ?'); params.append(f.start)
    if f.end:
        clauses.append('CAST(time AS DATE) <= ?'); params.append(f.end)
    if f.day_type != 'all':
        clauses.append('isodow(time) '+('IN (6,7)' if f.day_type=='weekend' else 'BETWEEN 1 AND 5'))
    col='PULocationID' if f.direction=='pickup' else 'DOLocationID'
    if f.zone:
        clauses.append(f'{col} = ?'); params.append(f.zone)
    if f.borough:
        ids=[k for k,v in zones().items() if v['Borough']==f.borough]
        clauses.append(f'{col} IN (SELECT unnest(?))'); params.append(ids)
    return ' AND '.join(clauses),params

def table(kind,f):
    w,p=where(f)
    col='PULocationID' if f.direction=='pickup' else 'DOLocationID'
    expressions={
      'hourly-demand':"extract(hour from time)::int AS hour, sum(trips)::bigint AS trips",
      'daily-demand':"CAST(time AS DATE)::varchar AS date, sum(trips)::bigint AS trips",
      'landscape':"isodow(time)::int AS day, extract(hour from time)::int AS hour, sum(trips)::bigint AS trips",
      'zones':f"{col} AS zone, sum(trips)::bigint AS trips, sum(fares)/sum(trips) AS average_fare",
      'origin-destination':"PULocationID AS origin, DOLocationID AS destination, sum(trips)::bigint AS trips",
      'weekdays':"isodow(time)::int AS day, sum(trips)::bigint AS trips, count(distinct CAST(time AS DATE)) AS days",
    }
    expr=expressions[kind]
    groups={'landscape':'1,2','origin-destination':'1,2'}.get(kind,'1')
    order='trips DESC' if kind in ('zones','origin-destination') else groups
    limit=' LIMIT ?' if kind in ('zones','origin-destination') else ''
    rows=query(f'SELECT {expr} FROM facts WHERE {w} GROUP BY {groups} ORDER BY {order}{limit}',p+([f.limit] if limit else []))
    lookup=zones()
    for r in rows:
        if 'zone' in r:
            r.update(name=lookup[r['zone']]['Zone'],borough=lookup[r['zone']]['Borough'])
        if 'origin' in r:
            r.update(origin_name=lookup[r['origin']]['Zone'],destination_name=lookup[r['destination']]['Zone'])
    return rows

def overview(f):
    w,p=where(f)
    r=query(f'SELECT coalesce(sum(trips),0)::bigint AS trips, coalesce(sum(fares),0) AS fares, coalesce(sum(distance)/sum(trips),0) AS distance, coalesce(sum(duration)/sum(trips),0) AS duration FROM facts WHERE {w}',p)[0]
    top=table('zones',f); hours=table('hourly-demand',f); days=table('daily-demand',f); flows=table('origin-destination',f)
    peak=max(hours,key=lambda r:r['trips']) if hours else None
    stories=[]
    if top: stories.append({'title':top[0]['name'],'detail':f"Most active {f.direction} zone · {top[0]['trips']:,} trips",'zone':top[0]['zone'],'page':'geo'})
    if peak: stories.append({'title':f"{peak['hour']:02d}:00 — the peak hour",'detail':f"{peak['trips']:,} trips across selected days",'hour':peak['hour'],'page':'analytics'})
    if days:
        day=max(days,key=lambda r:r['trips']); stories.append({'title':day['date'],'detail':f"Busiest date · {day['trips']:,} trips",'date':day['date'],'page':'analytics'})
    if flows: stories.append({'title':flows[0]['origin_name']+' → '+flows[0]['destination_name'],'detail':f"Top connection · {flows[0]['trips']:,} trips",'page':'geo'})
    return dict(r,top_zone=top[0]['name'] if top else None,peak_hour=peak['hour'] if peak else None,stories=stories,filters=f)

def distributions(f):
    w,p=where(f)
    result = {label:query(f'SELECT {column} AS bin, sum(count)::bigint AS trips FROM facts WHERE {w} GROUP BY 1 ORDER BY 1',p,'hist') for label,column in [('fare','fare_bin'),('distance','distance_bin'),('duration','duration_bin')]}
    result['relationship'] = query(f'SELECT distance_bin AS distance, fare_bin AS fare, sum(count)::bigint AS trips FROM facts WHERE {w} GROUP BY 1,2 ORDER BY trips DESC LIMIT 5000',p,'hist')
    return result

def anomalies(f):
    w,p=where(f)
    col='PULocationID' if f.direction=='pickup' else 'DOLocationID'
    # Baseline uses only earlier observations of the same weekday/hour/zone.
    rows=query(f'SELECT time, {col} AS zone, sum(trips)::int AS trips FROM facts WHERE {w} GROUP BY 1,2 ORDER BY 1',p)
    history={}; result=[]
    for r in rows:
        t=r['time']; key=(r['zone'],t.weekday(),t.hour)
        prior=history.setdefault(key,[])
        if len(prior)>=3:
            baseline=float(np.median(prior)); mad=float(np.median(np.abs(np.array(prior)-baseline)))
            scale=max(1.0,1.4826*mad); score=(r['trips']-baseline)/scale
            if abs(score)>3.5:
                result.append(dict(r,time=str(t),expected=baseline,score=score,name=zones()[r['zone']]['Zone']))
        prior.append(r['trips'])
    return sorted(result,key=lambda r:abs(r['score']),reverse=True)[:f.limit]
