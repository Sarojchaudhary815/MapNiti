You can learn the first parts of this book without installing anything: every cell marked **Python** runs in your browser. For real projects you will want Python on your own computer. This chapter shows the cleanest way to set it up for GIS work on Windows, macOS or Linux.

## Three ways to run Python

| Option | Install? | Best for |
|---|---|---|
| **This book / MapNiti Code Lab** | Nothing | Learning, quick calculations, testing ideas |
| **Google Colab** | Nothing (Google account) | Notebooks in the cloud, sharing with classmates |
| **conda on your computer** | Yes, once | Real projects, large files, GDAL and Rasterio |
| **QGIS Python Console** | Comes with QGIS | Automating QGIS itself (Part 5) |

## Why conda and not plain pip?

Geospatial libraries are Python wrappers around big C/C++ libraries: **GDAL** (file formats), **PROJ** (coordinate systems) and **GEOS** (geometry). Installing them with plain `pip` on Windows often fails or gives mismatched versions. **conda-forge** ships all of them pre-built and tested together.

## Step 1: Install Miniforge

Download Miniforge from [github.com/conda-forge/miniforge](https://github.com/conda-forge/miniforge) and run the installer with the default options. Miniforge is a small conda installer that uses conda-forge by default.

Then open **Miniforge Prompt** (Windows) or a terminal (macOS/Linux) and check it works:

```bash
conda --version
```

## Step 2: Create an environment for GIS work

An **environment** is a separate folder with its own Python and libraries. If something breaks, you delete the environment, not your whole computer setup.

```bash
conda create -n gis python=3.11
conda activate gis
```

- `-n gis` names the environment `gis`.
- `conda activate gis` switches into it. Your prompt now starts with `(gis)`.

## Step 3: Install the libraries

```bash
conda install -c conda-forge gdal geopandas rasterio folium matplotlib jupyterlab rasterstats
```

This one command installs everything used in this book. It takes a few minutes the first time.

A cleaner way for teams is an `environment.yml` file, so everyone gets the same versions:

```text
name: gis
channels:
  - conda-forge
dependencies:
  - python=3.11
  - gdal
  - geopandas
  - rasterio
  - folium
  - matplotlib
  - jupyterlab
  - rasterstats
```

Create the environment from the file with:

```bash
conda env create -f environment.yml
```

## Step 4: Start writing code

```bash
jupyter lab
```

JupyterLab opens in your browser. Click **Python 3** under *Notebook*, type code in a cell and press **Shift + Enter**. It works exactly like this book.

If you prefer an editor, install **VS Code** with the *Python* extension, then choose the `gis` environment as the interpreter (bottom-right corner of VS Code).

## Check your setup

Run this cell here, and later on your own computer. It prints the version of each library, or says which one is missing.

```python
import sys
print("Python", sys.version.split()[0])

import importlib
for name in ["numpy", "pandas", "matplotlib", "shapely", "pyproj", "geopandas"]:
    try:
        module = importlib.import_module(name)
        print(f"  {name:<11} {module.__version__}")
    except ImportError:
        print(f"  {name:<11} not installed")
```

- `import sys` loads a built-in module with information about Python itself.
- `importlib.import_module(name)` imports a library from its name as text, so we can loop over a list of names.
- `try / except ImportError` catches the error if a library is missing, instead of stopping (the chapter *Exceptions* explains this).
- `{name:<11}` pads the name to 11 characters so the versions line up.

> **Tip:** In the browser you will see the browser's versions. On your computer the versions will be newer, and `gdal` and `rasterio` will also be available.
