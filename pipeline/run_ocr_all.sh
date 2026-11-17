#!/bin/bash
# Run OCR one table at a time so partial progress survives interruptions.
cd "$(dirname "$0")"
for t in 1910_T2 1940_T5 1950_T7 1960_T8 1970_T6; do
  if [ ! -f ../data/interim/ocr_$t.csv ]; then python3 extract_census.py $t; fi
done
echo ALL_DONE
