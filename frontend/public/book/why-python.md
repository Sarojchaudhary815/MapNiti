Python is a free, general-purpose programming language that reads almost like English. In geospatial work it has become the common language: QGIS, ArcGIS Pro, Google Earth Engine, GDAL and most cloud platforms can all be driven from Python. This book teaches Python from the very first line up to real GIS analysis: vector data, rasters, DEMs and maps.

## Why engineers use Python for GIS

Clicking through a GIS works for one map. It does not work when you have 77 districts, 12 months of rainfall or 300 survey files. Python lets you write the steps once and repeat them any number of times.

| Reason | What it means in practice |
|---|---|
| **Automation** | Clip, reproject and summarise 100 files with one loop instead of 100 clicks |
| **Repeatability** | The script *is* the method. Anyone can rerun it and get the same answer |
| **Huge ecosystem** | GDAL, GeoPandas, Shapely, Rasterio, Earth Engine, scikit-learn, all free |
| **Glue language** | Read Excel, call a web API, run a GIS tool and write a report in one script |
| **Jobs** | Python appears in almost every GIS, remote sensing and data job advert |

## Your first line of Python

Press **Run** on the cell below. The code runs inside your browser (nothing is installed and nothing is sent to a server). The first run takes a few seconds while Python loads.

```python
print("Namaste from Python!")
```

`print()` is a **function**: a named action. Whatever you put inside the brackets is shown in the output area under the cell. Text must be inside quotes, so Python knows it is text and not a command.

Now change the text in the cell, for example to your own name, and press **Run** again. Every code cell in this book can be edited.

## A taste of what is coming

You do not need to understand the next cell yet. It calculates the area of a land parcel from its corner coordinates (in metres), the same job you would do in a survey office.

```python
corners = [(0, 0), (32.5, 0), (35.0, 18.2), (2.0, 21.0)]

area = 0
for i in range(len(corners)):
    x1, y1 = corners[i]
    x2, y2 = corners[(i + 1) % len(corners)]
    area += x1 * y2 - x2 * y1
area = abs(area) / 2

print(f"Area = {area:.2f} m²")
print(f"     = {area / 508.72:.3f} ropani")
```

What happened, line by line:

- `corners` is a **list** of coordinate pairs, the four corners of the plot.
- The `for` loop walks around the corners and applies the *shoelace formula*.
- `abs(area) / 2` makes the area positive and halves it, as the formula requires.
- The `f"..."` strings put numbers into text; `:.2f` means "2 decimal places".
- 1 ropani = 508.72 m², so dividing converts the units.

By the end of Part 2 you will be able to write code like this yourself.

## How to use this book

- **Run** a cell to execute it. Its output appears right below it.
- Cells in a chapter **share variables**, like a Jupyter notebook. If a cell says something is "not defined", run the cells above it first, or press **Run all** at the top.
- **Restart** clears all variables of the chapter and starts fresh.
- **Code Lab** opens the cell, together with the cells above it, in the full Code Lab editor.
- Cells marked **Desktop** need Python installed on your computer (or Google Colab, or QGIS). They show the output from a real run, so you can still follow along.

> **Further reading:** The structure of this book follows the free open book *Python For Geospatial Analysis* by Aditya Kushwaha ([pga.kaditya97.com.np](https://pga.kaditya97.com.np/intro.html)), which is a good companion. The text, examples and datasets here are written separately by MapNiti, with Nepal examples you can run in the browser.
