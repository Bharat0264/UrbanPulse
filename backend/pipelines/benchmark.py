import json
import time
from pyspark.sql import functions as F
from backend.pipelines.process import session
from backend.app.services.config import ROOT, DATA

def main():
    spark=session(); spark.sparkContext.setLogLevel('ERROR'); results=[]
    files=sorted((ROOT/'data/raw').glob('yellow_tripdata_*.parquet'))
    for size in [10000,100000,1000000]:
        df=spark.read.parquet(*map(str,files)).select('tpep_pickup_datetime','PULocationID','trip_distance').limit(size).cache(); n=df.count()
        for operation,fn in [('read_parquet',lambda:spark.read.parquet(*map(str,files)).limit(size).select(F.sum('trip_distance')).collect()),
                             ('filter',lambda:df.filter('trip_distance > 2').count()),
                             ('group_zones',lambda:df.groupBy('PULocationID').count().collect()),
                             ('hourly_demand',lambda:df.groupBy(F.date_trunc('hour','tpep_pickup_datetime')).count().collect())]:
            elapsed=[]
            for _ in range(3):
                t=time.perf_counter(); fn(); elapsed.append(time.perf_counter()-t)
            results.append({'rows':n,'operation':operation,'seconds':elapsed,'median_seconds':sorted(elapsed)[1]})
        df.unpersist()
    output={'results':results,'methodology':'Local[2], three measured repetitions. Filter/group operate on cached input. Read forces a distance sum, with OS filesystem caching possible. Row limits are not random samples. Not a distributed-cluster benchmark.'}
    (DATA/'benchmarks.json').write_text(json.dumps(output,indent=2)); spark.stop()
if __name__=='__main__': main()
