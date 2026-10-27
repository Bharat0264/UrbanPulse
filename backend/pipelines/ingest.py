"""Download official TLC sources atomically, validate parquet, record SHA256."""
import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path
import requests
import pyarrow.parquet as pq
import shapefile
from pyproj import Transformer
from shapely.geometry import shape, mapping
from shapely.ops import transform
from backend.app.services.config import ROOT
RAW = ROOT / 'data/raw'
BASE = 'https://d37ci6vzurychx.cloudfront.net'

def download(url, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        return
    temp = destination.with_suffix(destination.suffix + '.part')
    with requests.get(url, stream=True, timeout=(20, 180)) as response:
        response.raise_for_status()
        expected = int(response.headers.get('Content-Length', 0))
        size = 0
        with temp.open('wb') as out:
            for chunk in response.iter_content(1024 * 1024):
                out.write(chunk)
                size += len(chunk)
        if expected and size != expected:
            raise ValueError(f'Incomplete download: {destination.name}')
    temp.replace(destination)

def geography():
    download(f'{BASE}/misc/taxi_zone_lookup.csv', RAW / 'taxi_zone_lookup.csv')
    archive = RAW / 'taxi_zones.zip'
    download(f'{BASE}/misc/taxi_zones.zip', archive)
    folder = RAW / 'boundaries'
    folder.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        for name in z.namelist():
            if '..' in Path(name).parts or Path(name).is_absolute():
                raise ValueError('Unsafe archive path')
        z.extractall(folder)
    reader = shapefile.Reader(str(next(folder.rglob('taxi_zones.shp'))))
    project = Transformer.from_crs('EPSG:2263', 'EPSG:4326', always_xy=True).transform
    features = []
    for record in reader.shapeRecords():
        props = record.record.as_dict()
        geom = transform(project, shape(record.shape.__geo_interface__))
        centroid = geom.centroid
        features.append({'type':'Feature', 'geometry':mapping(geom.simplify(0.00008, preserve_topology=True)),
                         'properties':{'id':int(props['LocationID']), 'name':props['zone'], 'borough':props['borough'],
                                       'centroid':[centroid.x, centroid.y]}})
    (RAW / 'taxi-zones.geojson').write_text(json.dumps({'type':'FeatureCollection', 'features':features}))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--months', nargs='+', default=['2024-01','2024-02','2024-03'])
    args = parser.parse_args()
    manifest = []
    geography()
    for month in args.months:
        if not re.fullmatch(r'20\d{2}-(0[1-9]|1[0-2])', month):
            parser.error('Months must have YYYY-MM format')
        path = RAW / f'yellow_tripdata_{month}.parquet'
        download(f'{BASE}/trip-data/{path.name}', path)
        metadata = pq.ParquetFile(path)
        manifest.append({'month':month, 'file':path.name, 'bytes':path.stat().st_size,
                         'rows':metadata.metadata.num_rows, 'schema':str(metadata.schema_arrow),
                         'sha256':hashlib.file_digest(path.open('rb'),'sha256').hexdigest() if hasattr(hashlib,'file_digest') else hashlib.sha256(path.read_bytes()).hexdigest()})
        print(json.dumps(manifest[-1]), flush=True)
    (RAW / 'manifest.json').write_text(json.dumps(manifest, indent=2))

if __name__ == '__main__':
    main()
