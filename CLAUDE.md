# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LifeTracer is a static website for a computational framework that processes and analyzes mass spectrometry data to distinguish abiotic from biotic origins in organic compounds. The project is a GitHub Pages site showcasing research on molecular distributions in meteorite and terrestrial geological samples.

## Development Commands

### Local Development
```bash
# Serve the website locally using Python's built-in HTTP server
python -m http.server

# Then visit http://localhost:8000 in your browser
```

This is the primary command needed for development - the project is a static site with no build process.

## Code Architecture

### Core Components

- **index.html**: Main landing page with project abstract, navigation, and author information
- **OnlineSampleClassifier.html**: Interactive web application for sample classification using logistic regression
- **app.js**: Main JavaScript logic for the Online Sample Classifier functionality
- **peaks.html, features.html, feature_groups.html**: Data visualization pages using PapaParse for CSV processing
- **3d_plots_*.html**: Interactive 3D visualization pages

### Data Structure

The project processes CSV files containing:
- **lr_l2_top_features_combined.csv**: Logistic regression coefficients and feature data
- **features_per_sample/**: Directory containing individual sample feature files
- **sample_feature_summary.csv**: Summary statistics for sample features

### Key JavaScript Architecture (app.js)

The Online Sample Classifier implements:
- **Logistic Regression Engine**: Uses pre-trained coefficients to classify samples
- **Feature Matching**: Tolerance-based matching of m/z, RT1, and RT2 values
- **CSV Processing**: Custom parser handling quoted strings and multi-column data
- **SHAP-like Visualization**: Feature contribution analysis with waterfall charts
- **File Upload**: Drag-and-drop CSV upload functionality

### Global State Management
```javascript
let coefficients = [];  // Loaded from CSV
let features = [];      // User-entered features
let sampleSummary = {}; // Sample metadata
```

### Classification Algorithm
The classifier uses logistic regression with:
- Intercept: 0.03806688
- Feature matching within user-defined tolerances
- Binary classification: 0 (Meteorite) vs 1 (Earth Sample)
- Probability calculation: 1 / (1 + exp(-logit))

### Data Visualization Pages

All visualization pages (peaks.html, features.html, etc.) follow a consistent pattern:
- Use PapaParse library for CSV processing
- Implement filtering and search functionality
- Display tabular data with sortable columns
- Include Font Awesome icons and Roboto fonts

## File Relationships

- The main navigation in index.html links to all sub-pages
- app.js is specifically tied to OnlineSampleClassifier.html
- All HTML pages share consistent styling patterns and external dependencies
- CSV data files are loaded dynamically via fetch() calls

## External Dependencies

- **PapaParse**: CSV parsing library (v5.3.0)
- **Font Awesome**: Icons (v6.0.0-beta3)
- **Google Fonts**: Roboto font family
- **Python HTTP Server**: For local development only