"""Make/restore a small reproducible offline sample of real, unmodified TLC rows."""
import argparse
import json
import shutil
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
from backend.app.services.config import ROOT
from backend.pipelines.process import COLUMNS

def create():
    folder=ROOT/'data/samples'; folder.mkdir(exist_ok=True)
    rng=np.random.default_rng(42); tables=[]; sources=[]
    for path in sorted((ROOT/'data/raw').glob('yellow_tripdata_*.parquet')):
        pf=pq.ParquetFile(path); sources.append({'file':path.name,'rows':pf.metadata.num_rows})
        fraction=min(1,20000/pf.metadata.num_rows)
        for batch in pf.iter_batches(batch_size=50000,columns=list(COLUMNS)):
            mask=pa.array(rng.random(batch.num_rows)<fraction)
            table=pa.Table.from_batches([batch]).filter(mask)
            table=table.cast(pa.schema([pa.field(c,pa.timestamp('us') if 'datetime' in c else pa.int32() if 'LocationID' in c else pa.float64()) for c in COLUMNS]))
            tables.append(table)
    result=pa.concat_tables(tables)
    pq.write_table(result,folder/'trips.parquet',compression='zstd')
    for name in ['taxi_zone_lookup.csv','taxi-zones.geojson']:
        shutil.copy2(ROOT/'data/raw'/name,folder/name)
    (folder/'provenance.json').write_text(json.dumps({'source':'Official NYC TLC yellow taxi records','sources':sources,'rows':result.num_rows,'seed':42,'method':'Bernoulli sample, approximately 20,000 original rows per month. No fabricated records.'},indent=2))
    print(f'Created {result.num_rows:,} real sample rows')

def restore():
    for name in ['taxi_zone_lookup.csv','taxi-zones.geojson']:
        shutil.copy2(ROOT/'data/samples'/name,ROOT/'data/raw'/name)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['create','restore']);args=parser.parse_args()
    create() if args.action=='create' else restore()
