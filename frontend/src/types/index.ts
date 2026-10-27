export type Row = { [key: string]: any };
export type Filters = {
  start: string;
  end: string;
  borough: string;
  zone: string;
  hour_start: string;
  hour_end: string;
  day_type: string;
  direction: string;
};
export const defaultFilters: Filters = {
  start: "",
  end: "",
  borough: "",
  zone: "",
  hour_start: "0",
  hour_end: "23",
  day_type: "all",
  direction: "pickup",
};
export type Metadata = {
  mode: string;
  months: string[];
  start: string;
  end: string;
  input_rows: number;
  cleaned_rows: number;
  rejected_rows: number;
  source_rows: number;
  input_bytes: number;
  output_bytes: number;
  spark_version: string;
  duration_seconds: number;
  aggregation_seconds: number;
  partitions: number;
  master: string;
  status: string;
  completed_at: string;
  aggregate_rows: number;
  cleaning: string;
};
