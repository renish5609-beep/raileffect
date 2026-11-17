# Reproduce the RailEffect research pipeline. Requires Python deps (pipeline/requirements.txt),
# Tesseract 5 and poppler-utils (pdftoppm). Raw downloads are logged in data/metadata/acquisition_log.json.
PY ?= python3
P = cd pipeline &&

.PHONY: pipeline acquire ocr analysis web report test
pipeline: acquire ocr analysis web report

acquire:
	$(P) $(PY) acquire_census.py && $(PY) acquire_railroads.py && $(PY) process_railroads.py && $(PY) build_network.py && $(PY) modern_population.py && $(PY) build_gazetteer.py

ocr:
	$(P) ./run_ocr_all.sh && $(PY) reconcile_population.py && $(PY) build_towns.py

analysis:
	$(P) $(PY) compute_accessibility.py && $(PY) fit_models.py

web:
	$(P) $(PY) export_web_data.py

report:
	$(P) $(PY) make_report.py

test:
	$(PY) -m pytest pipeline/tests -q && npm test
