"""Actual Spark ETL. All dashboard summaries originate from these validated rows."""
import argparse
import json
import time
import uuid
from datetime import datetime
from functools import reduce
from pyspark.sql import SparkSession, functions as F
from backend.app.services.config import ROOT, DATA

COLUMNS = {'tpep_pickup_datetime':'timestamp_ntz', 'tpep_dropoff_datetime':'timestamp_ntz',
           'PULocationID':'int', 'DOLocationID':'int', 'trip_distance':'double', 'fare_amount':'double'}

def clean(df, valid_ids, months):
    df = df.select(*[F.col(c).cast(t).alias(c) for c,t in COLUMNS.items()])
    df = df.withColumn('duration', F.expr('timestampdiff(SECOND, tpep_pickup_datetime, tpep_dropoff_datetime)')/60)
    valid = (F.col('PULocationID').isin(valid_ids) & F.col('DOLocationID').isin(valid_ids)
             & F.date_format('tpep_pickup_datetime','yyyy-MM').isin(months)
             & F.col('duration').between(1,180) & F.col('trip_distance').between(0.01,200)
             & F.col('fare_amount').between(0,1000)
             & ~F.isnan('trip_distance') & ~F.isnan('fare_amount'))
    return df.filter(valid).withColumn('time',F.date_trunc('hour','tpep_pickup_datetime').cast('timestamp_ntz')).withColumn('month',F.date_format('time','yyyy-MM'))

def session(partitions=8):
    return (SparkSession.builder.master('local[2]').appName('UrbanPulse ETL')
            .config('spark.sql.session.timeZone','America/New_York')
            .config('spark.sql.shuffle.partitions',str(partitions))
            .config('spark.driver.bindAddress','127.0.0.1').getOrCreate())

def process(months, sample_rows=0, partitions=8, sample_file=False):
    start = time.perf_counter()
    spark = session(partitions)
    spark.sparkContext.setLogLevel('ERROR')
    DATA.mkdir(parents=True, exist_ok=True)
    paths = [ROOT/'data/samples/trips.parquet'] if sample_file else [ROOT / f'data/raw/yellow_tripdata_{m}.parquet' for m in months]
    # Cast before union: monthly physical schemas can differ.
    frames = [spark.read.parquet(str(p)).select(*[F.col(c).cast(t).alias(c) for c,t in COLUMNS.items()]) for p in paths]
    raw = reduce(lambda a,b:a.unionByName(b), frames)
    source_rows = raw.count()
    if sample_rows:
        raw = raw.sample(False, min(1, sample_rows / source_rows), seed=42)
    raw = raw.cache()
    original = raw.count()
    zones = spark.read.option('header',True).csv(str(ROOT/'data/raw/taxi_zone_lookup.csv'))
    ids = [int(r.LocationID) for r in zones.collect() if int(r.LocationID) <= 263]
    df = clean(raw, ids, months).cache()
    count = df.count()
    if not count:
        raise ValueError('No valid records remain after cleaning')
    bounds = df.agg(F.min('time').alias('start'),F.max('time').alias('end')).first()
    agg_start = time.perf_counter()
    cube = df.groupBy('month','time','PULocationID','DOLocationID').agg(
        F.count('*').alias('trips'),F.sum('fare_amount').alias('fares'),
        F.sum('trip_distance').alias('distance'),F.sum('duration').alias('duration'))
    cube.repartition(partitions,'month').write.mode('overwrite').partitionBy('month').parquet(str(DATA/'cube'))
    hourly = df.groupBy('time','PULocationID').count().withColumnRenamed('count','trips')
    hourly.write.mode('overwrite').parquet(str(DATA/'zone_hour'))
    # Multivariate histogram preserves shared date/zone/direction filters.
    hist = df.withColumn('fare_bin',F.floor(F.col('fare_amount')/5)*5).withColumn('distance_bin',F.floor('trip_distance')).withColumn('duration_bin',F.floor(F.col('duration')/5)*5)
    hist.groupBy('month','time','PULocationID','DOLocationID','fare_bin','distance_bin','duration_bin').count().write.mode('overwrite').partitionBy('month').parquet(str(DATA/'hist'))
    aggregation_seconds = time.perf_counter()-agg_start
    cube_count = spark.read.parquet(str(DATA/'cube')).count()
    metadata = {'dataset_id':str(uuid.uuid4()),'source':'NYC TLC yellow taxi trip records',
                'mode':'sample' if sample_rows or sample_file else 'full','sample_method':'Seeded Bernoulli sample of real TLC records; not full city demand' if sample_rows or sample_file else None,
                'months':months,'source_rows':source_rows,'input_rows':original,'cleaned_rows':count,'rejected_rows':original-count,
                'aggregate_rows':cube_count,'input_bytes':sum(p.stat().st_size for p in paths),
                'output_bytes':sum(p.stat().st_size for p in DATA.rglob('*.parquet')),
                'start':str(bounds.start),'end':str(bounds.end),'spark_version':spark.version,'master':spark.sparkContext.master,
                'partitions':partitions,'aggregation_seconds':aggregation_seconds,'duration_seconds':time.perf_counter()-start,
                'completed_at':datetime.now().isoformat(),'status':'completed','timezone':'America/New_York',
                'cleaning':'Known zones 1–263; pickup in selected months; duration 1–180 min; distance (0,200] mi; fare [0,1000] USD. Null/NaN/invalid rows rejected.'}
    (DATA/'metadata.json').write_text(json.dumps(metadata, indent=2))
    spark.stop()
    print(json.dumps(metadata, indent=2))

if __name__ == '__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--months',nargs='+',default=['2024-01','2024-02','2024-03'])
    p.add_argument('--sample-rows',type=int,default=0)
    p.add_argument('--partitions',type=int,default=8)
    p.add_argument('--sample',action='store_true',help='Use bundled offline real TLC sample')
    a=p.parse_args()
    process(a.months,a.sample_rows,a.partitions,a.sample)
