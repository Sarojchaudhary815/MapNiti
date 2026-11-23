A program works with **values**: a station name, an elevation, a rainfall total, a yes/no answer. A **variable** is a name you give to a value so you can use it again later. This chapter covers the basic kinds of values in Python and how to store them.

## Creating a variable

You create a variable with the `=` sign. The name goes on the left, the value on the right.

```python
station = "Pokhara Airport"
elevation = 827
annual_rain = 3900.5

print(station)
print(elevation)
print(annual_rain)
```

- `station` now holds the text `"Pokhara Airport"`.
- `elevation` holds the whole number `827`.
- `annual_rain` holds the decimal number `3900.5`.
- In Python, `=` means *"store this value under this name"*. It is not the equals sign from maths.

You can change a variable at any time. The old value is simply replaced:

```python
elevation = 827
print("Before:", elevation)

elevation = 830        # a new survey gave a better value
print("After:", elevation)
```

The text after `#` is a **comment**. Python ignores it; it is a note for people reading the code.

## The four basic data types

Every value has a **type**. The type decides what you can do with it: you can divide numbers, but not names.

| Type | Name in Python | Examples | Used for |
|---|---|---|---|
| Integer | `int` | `827`, `-5`, `2024` | Counts, years, IDs, elevations in whole metres |
| Floating point | `float` | `27.7172`, `3900.5`, `1e-3` | Coordinates, measurements, anything with decimals |
| String | `str` | `"Kaski"`, `'BM1'` | Names, codes, labels, file paths |
| Boolean | `bool` | `True`, `False` | Yes/no answers: *is it flooded?* |

The built-in function `type()` tells you the type of any value:

```python
lat = 28.2009
district = "Kaski"
population = 600051
is_capital = False

print(type(lat))
print(type(district))
print(type(population))
print(type(is_capital))
```

## Strings: working with text

Text values are written inside single `'...'` or double `"..."` quotes. Strings come with many useful **methods**: actions you call with a dot after the value.

```python
name = "  pokhara airport  "

clean = name.strip()           # remove spaces at both ends
print(clean)
print(clean.title())           # Capitalise Each Word
print(clean.upper())           # ALL CAPITALS
print(clean.replace("airport", "station"))
print(len(clean), "characters")
```

- `strip()` is the first thing to do with text typed by people; stray spaces cause many bugs.
- `title()`, `upper()` and `replace()` return a **new** string. The original `name` is not changed.
- `len()` counts the characters.

## Putting values into text: f-strings

To build a sentence that contains values, put an `f` before the quotes and the variable names inside `{}`:

```python
station = "Jumla"
elevation = 2300
rain = 812.456

print(f"{station} is at {elevation} m and received {rain} mm of rain.")
print(f"Rounded: {rain:.1f} mm")
print(f"With thousands separator: {1234567:,} people")
```

The part after the colon is a **format**: `.1f` means one decimal place; `,` adds thousands separators. You will use f-strings in almost every program.

## Converting between types

Data read from files or typed by a user always arrives as **text**, even if it looks like a number. You must convert it before doing maths:

```python
reading = "1.452"              # a staff reading typed into a form
print(reading + reading)       # joining two pieces of text!

value = float(reading)         # convert text to a decimal number
print(value + value)           # now it is real addition

print(int("2024") + 1)         # text to whole number
print(str(827) + " m")         # number to text
print(int(27.98))              # int() cuts off the decimals, it does not round
```

- `"1.452" + "1.452"` gives `"1.4521.452"`, because `+` *joins* strings.
- `float()`, `int()` and `str()` convert between types.
- `int(27.98)` gives `27`. Use `round(27.98)` if you want `28`.

## Naming rules and good names

```python
# Valid names
station_name = "Simara"
elev_m = 130
rain_2023 = 1800

# A name can't start with a digit or contain spaces or dashes:
# 2023_rain = 10   → SyntaxError
# rain-2023 = 10   → SyntaxError

print(station_name, elev_m, rain_2023)
```

Good habits:

- Use lowercase words joined by underscores: `annual_rain_mm`, not `ARM` or `x1`.
- Put the **unit** in the name when it matters: `length_m`, `area_km2`, `slope_deg`. This prevents many engineering mistakes.
- Python is **case-sensitive**: `Station` and `station` are two different variables.

## Several values at once

Python can assign several variables in one line, which is handy for coordinates:

```python
lat, lon = 27.7172, 85.3240
print("Latitude:", lat)
print("Longitude:", lon)

# Swap two values without a temporary variable
a, b = 10, 20
a, b = b, a
print(a, b)
```

## Practice

> **Try it:** In the cell below, store the name, latitude, longitude and elevation of your own town in four variables. Then print one sentence that uses all four, with the coordinates rounded to 3 decimal places.

```python
town = "Dhankuta"
lat = 26.9833
lon = 87.3500
elevation_m = 1210

print(f"{town}: {lat:.3f} N, {lon:.3f} E, {elevation_m} m above sea level")
```

## Key points

- A variable is a name for a value: `name = value`.
- The basic types are `int`, `float`, `str` and `bool`; check with `type()`.
- Text from files and forms must be converted with `float()` or `int()` before maths.
- Use f-strings to put values into text, with formats like `:.2f`.
