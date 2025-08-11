// Constants
const INTERCEPT = 0.03806688;
const CSV_PATH = 'lr_l2_top_features_combined.csv';
const SAMPLE_FEATURES_PATH = 'features_per_sample/';
const SAMPLE_SUMMARY_PATH = 'sample_feature_summary.csv';
const SAMPLE_FILES = [
    "Aguas_Zarcas_features.csv",
    "ALH_83100_features.csv",
    "Antarctica_features.csv",
    "Atacama_features.csv",
    "EET_96029_features.csv",
    "Green_R._Shale_features.csv",
    "GSFC_features.csv",
    "Iceland_features.csv",
    "Jarosite_features.csv",
    "Jbilet_Winselwan_features.csv",
    "LEW_85311_features.csv",
    "Lignite_features.csv",
    "LON_94101_features.csv",
    "Murchison_features.csv",
    "Murchison_Soil_features.csv",
    "Orgueil_features.csv",
    "Rio_Tinto_features.csv",
    "Utah_features.csv"
];

// Global state
let coefficients = [];
let features = [];
let sampleSummary = {};

// DOM Elements
const mzInput = document.getElementById('mz');
const rt1Input = document.getElementById('rt1');
const rt2Input = document.getElementById('rt2');
const mzToleranceInput = document.getElementById('mz-tolerance');
const rt1ToleranceInput = document.getElementById('rt1-tolerance');
const rt2ToleranceInput = document.getElementById('rt2-tolerance');
const addFeatureBtn = document.getElementById('add-feature-btn');
const featuresList = document.getElementById('features-list');
const runPredictionBtn = document.getElementById('run-prediction-btn');
const resultsCard = document.getElementById('results-card');
const matchedFeaturesTable = document.getElementById('matched-features-table');
const noMatchesWarning = document.getElementById('no-matches-warning');
const logitValue = document.getElementById('logit-value');
const probabilityValue = document.getElementById('probability-value');
const classValue = document.getElementById('class-value');
const sampleButtonsContainer = document.getElementById('sample-buttons');

// Load coefficients from CSV
async function loadCoefficients() {
    try {
        const response = await fetch(CSV_PATH);
        if (!response.ok) {
            throw new Error(`Failed to load CSV: ${response.status} ${response.statusText}`);
        }
        
        const csvText = await response.text();
        coefficients = parseCSV(csvText);
        console.log(`Loaded ${coefficients.length} coefficients`);
    } catch (error) {
        showError(`Error loading coefficients: ${error.message}`, error.stack);
    }
}

// Simple CSV parser
function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',');
    
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Handle commas in quoted strings
        const values = [];
        let inQuotes = false;
        let currentValue = '';
        
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(currentValue);
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        
        values.push(currentValue); // Push the last value
        
        const entry = {
            coefficient: parseFloat(values[1]),
            mz: parseFloat(values[2]),
            RT1_center: parseFloat(values[5]),
            RT2_center: parseFloat(values[6]),
            samples: values[7],
            class: parseInt(values[9])
        };
        
        if (!isNaN(entry.coefficient) && !isNaN(entry.mz) && 
            !isNaN(entry.RT1_center) && !isNaN(entry.RT2_center) && 
            !isNaN(entry.class)) {
            result.push(entry);
        }
    }
    
    return result;
}

// Show error dialog
function showError(message, stack) {
    alert(`Error: ${message}\n\nStack trace: ${stack}`);
    console.error(message, stack);
}

// Validate input is a finite number
function isValidNumber(value) {
    const num = parseFloat(value);
    return !isNaN(num) && isFinite(num);
}

// Initialize sample buttons
async function initializeSampleButtons() {
    // Load sample summary data
    await loadSampleSummary();
    
    // Clear the container first
    sampleButtonsContainer.innerHTML = '';
    
    // Create buttons for each sample
    SAMPLE_FILES.forEach(sampleFile => {
        // Extract sample name from filename (remove _features.csv)
        const sampleName = sampleFile.replace('_features.csv', '');
        const displayName = sampleName.replace(/_/g, ' ');
        
        // Get feature count from summary if available
        const featureCount = sampleSummary[displayName] || '';
        
        // Create button element
        const button = document.createElement('button');
        button.className = 'sample-button';
        
        // Add both name and feature count if available
        if (featureCount) {
            button.innerHTML = `${displayName} <span class="feature-count">(${featureCount})</span>`;
        } else {
            button.textContent = displayName;
        }
        
        button.setAttribute('data-filename', sampleFile);
        
        // Add click event to load sample features
        button.addEventListener('click', () => loadSampleFeatures(sampleFile));
        
        // Add to container
        sampleButtonsContainer.appendChild(button);
    });
}

// Load sample summary data
async function loadSampleSummary() {
    try {
        const response = await fetch(SAMPLE_SUMMARY_PATH);
        if (!response.ok) {
            console.warn(`Could not load sample summary: ${response.status} ${response.statusText}`);
            return;
        }
        
        const csvText = await response.text();
        const lines = csvText.split('\n');
        
        // Skip header
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const [name, count] = line.split(',');
            if (name && count) {
                sampleSummary[name.trim()] = parseInt(count.trim());
            }
        }
    } catch (error) {
        console.warn(`Error loading sample summary: ${error.message}`);
    }
}

// Load features from a sample file
async function loadSampleFeatures(filename) {
    // Clear existing features
    features = [];
    featuresList.innerHTML = '';
    
    try {
        // Mark the selected button as active
        document.querySelectorAll('.sample-button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-filename') === filename) {
                btn.classList.add('active');
            }
        });
        
        // Fetch the sample file
        const response = await fetch(SAMPLE_FEATURES_PATH + filename);
        if (!response.ok) {
            throw new Error(`Failed to load sample: ${response.status} ${response.statusText}`);
        }
        
        const csvText = await response.text();
        const sampleFeatures = parseFeatureCSV(csvText);
        
        // Add each feature to the list
        sampleFeatures.forEach(feature => {
            addFeatureToList(feature.mz, feature.rt1, feature.rt2);
        });
        
        // Enable run button and automatically run prediction
        updateRunButtonState();
        if (features.length > 0) {
            runLogisticRegression();
        }
    } catch (error) {
        showError(`Error loading sample features: ${error.message}`, error.stack);
    }
}

// Parse feature CSV file (m/z,RT1,RT2 format)
function parseFeatureCSV(csvText) {
    const lines = csvText.split('\n');
    const result = [];
    
    // Check if there's a header row
    let startRow = 0;
    let mzIndex = 0;
    let rt1Index = 1;
    let rt2Index = 2;
    
    if (lines[0].toLowerCase().includes('m/z')) {
        startRow = 1;
        
        // Parse header to find correct column indices
        const headers = lines[0].toLowerCase().split(',');
        headers.forEach((header, index) => {
            if (header.includes('m/z')) {
                mzIndex = index;
            } else if (header.includes('rt1') || header.includes('rt1_center')) {
                rt1Index = index;
            } else if (header.includes('rt2') || header.includes('rt2_center')) {
                rt2Index = index;
            }
        });
    }
    
    for (let i = startRow; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',');
        if (values.length < Math.max(mzIndex, rt1Index, rt2Index) + 1) continue;
        
        const mz = parseFloat(values[mzIndex]);
        const rt1 = parseFloat(values[rt1Index]);
        const rt2 = parseFloat(values[rt2Index]);
        
        if (!isNaN(mz) && !isNaN(rt1) && !isNaN(rt2)) {
            result.push({ mz, rt1, rt2 });
        }
    }
    
    return result;
}

// Add a feature to the list (used by both manual add and sample loading)
function addFeatureToList(mz, rt1, rt2) {
    const feature = { mz, rt1, rt2 };
    features.push(feature);
    
    // Add to UI
    const featureElement = document.createElement('div');
    featureElement.className = 'feature-item';
    featureElement.innerHTML = `
        <span>m/z: ${mz.toFixed(4)}, RT1: ${rt1.toFixed(4)}, RT2: ${rt2.toFixed(4)}</span>
        <button class="delete-btn">×</button>
    `;
    
    const deleteBtn = featureElement.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => {
        const index = features.findIndex(f => 
            f.mz === mz && f.rt1 === rt1 && f.rt2 === rt2
        );
        
        if (index !== -1) {
            features.splice(index, 1);
            featureElement.remove();
            updateRunButtonState();
        }
    });
    
    featuresList.appendChild(featureElement);
}

// Add a feature triplet to the list
function addFeature() {
    const mz = parseFloat(mzInput.value);
    const rt1 = parseFloat(rt1Input.value);
    const rt2 = parseFloat(rt2Input.value);
    
    if (!isValidNumber(mz) || !isValidNumber(rt1) || !isValidNumber(rt2)) {
        alert('Please enter valid numbers for all fields');
        return;
    }
    
    addFeatureToList(mz, rt1, rt2);
    
    // Clear inputs
    mzInput.value = '';
    rt1Input.value = '';
    rt2Input.value = '';
    mzInput.focus();
    
    updateRunButtonState();
}

// Update the state of the run prediction button
function updateRunButtonState() {
    runPredictionBtn.disabled = features.length === 0;
}

// Perform logistic regression calculation
function runLogisticRegression() {
    const featureContributions = [];
    const mzTolerance = parseFloat(mzToleranceInput.value);
    const rt1Tolerance = parseFloat(rt1ToleranceInput.value);
    const rt2Tolerance = parseFloat(rt2ToleranceInput.value);
    
    if (!isValidNumber(mzTolerance) || !isValidNumber(rt1Tolerance) || !isValidNumber(rt2Tolerance)) {
        alert('Please enter valid tolerance values');
        return;
    }
    
    let totalContribution = 0;
    let hasNoMatches = false;
    
    // Clear previous results
    resultsCard.style.display = 'block';
    matchedFeaturesTable.querySelector('tbody').innerHTML = '';
    document.getElementById('feature-contribution-table').querySelector('tbody').innerHTML = '';
    document.getElementById('feature-contribution-chart').innerHTML = '';
    noMatchesWarning.style.display = 'none';
    
    // Track contributions per feature
    for (const feature of features) {
        const matches = coefficients.filter(coef => 
            Math.abs(feature.mz - coef.mz) <= mzTolerance &&
            Math.abs(feature.rt1 - coef.RT1_center) <= rt1Tolerance &&
            Math.abs(feature.rt2 - coef.RT2_center) <= rt2Tolerance
        );
        
        if (matches.length === 0) {
            hasNoMatches = true;
            continue;
        }
        
        // Calculate contribution for this feature
        const contribution = matches.reduce((sum, match) => sum + match.coefficient, 0);
        totalContribution += contribution;
        
        // Store feature contribution for analysis
        featureContributions.push({
            feature,
            matches,
            contribution,
            featureKey: `(${feature.mz.toFixed(4)}, ${feature.rt1.toFixed(4)}, ${feature.rt2.toFixed(4)})`
        });
        
        // Add matches to the table
        for (const match of matches) {
            const distance = Math.sqrt(
                Math.pow(feature.mz - match.mz, 2) +
                Math.pow(feature.rt1 - match.RT1_center, 2) +
                Math.pow(feature.rt2 - match.RT2_center, 2)
            );
            
            const classText = match.class === 0 ? "Meteorite (0)" : "Earth Sample (1)";
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>(${feature.mz.toFixed(4)}, ${feature.rt1.toFixed(4)}, ${feature.rt2.toFixed(4)})</td>
                <td>${match.coefficient.toFixed(6)}</td>
                <td>${match.mz.toFixed(4)}</td>
                <td>${match.RT1_center.toFixed(4)}</td>
                <td>${match.RT2_center.toFixed(4)}</td>
                <td>${distance.toFixed(6)}</td>
                <td>${match.samples}</td>
                <td>${classText}</td>
            `;
            
            matchedFeaturesTable.querySelector('tbody').appendChild(row);
        }
    }
    
    if (hasNoMatches) {
        noMatchesWarning.style.display = 'block';
    }
    
    const logit = INTERCEPT + totalContribution;
    
    // Use the probability calculation directly from logistic regression formula
    const probability = 1 / (1 + Math.exp(-logit));
    
    // Check if we have matches with a negative coefficient (indicates class 0)
    const hasNegativeCoefficients = matchedFeaturesTable.querySelectorAll('tbody tr').length > 0 && 
                                   totalContribution < 0;
    
    // If we have clear negative signal, use 0, otherwise use standard threshold
    const binaryClass = hasNegativeCoefficients ? 0 : (probability >= 0.5 ? 1 : 0);
    const classDescription = binaryClass === 0 ? "Meteorite" : "Earth Sample";
    
    logitValue.textContent = logit.toFixed(6);
    probabilityValue.textContent = binaryClass === 0 ? (1 - probability).toFixed(4) : (probability).toFixed(4);
    classValue.textContent = `${binaryClass} (${classDescription})`;
    
    // Generate feature contribution analysis (SHAP-like)
    displayFeatureContributions(featureContributions, totalContribution);
}

// Display the contribution of each feature in a SHAP-like visualization
function displayFeatureContributions(featureContributions, totalContribution) {
    // Skip if no contributions
    if (featureContributions.length === 0) return;
    
    // Sort by absolute contribution (most significant first)
    featureContributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    
    const contributionTable = document.getElementById('feature-contribution-table').querySelector('tbody');
    const chartContainer = document.getElementById('feature-contribution-chart');
    chartContainer.innerHTML = ''; // Clear previous chart
    
    // Calculate total absolute contribution for percentage calculation
    const totalAbsContribution = featureContributions.reduce(
        (sum, item) => sum + Math.abs(item.contribution), 
        Math.abs(INTERCEPT)
    );
    
    // Add intercept as a "feature"
    const allContributions = [
        {
            featureKey: 'Intercept',
            contribution: INTERCEPT,
            value: INTERCEPT.toFixed(6)
        },
        ...featureContributions.map(fc => ({
            ...fc,
            value: `${fc.feature.mz.toFixed(4)}, ${fc.feature.rt1.toFixed(4)}, ${fc.feature.rt2.toFixed(4)}`
        }))
    ];
    
    // Find actual max contribution for more appropriate scaling
    const maxAbsContribution = Math.max(...allContributions.map(c => Math.abs(c.contribution)));
    
    // For better display of small values, use a dynamic scale rather than fixed max of 1
    // We'll round up to the next nice number
    const niceMaxValue = maxAbsContribution <= 0.1 ? 0.1 : 
                        maxAbsContribution <= 0.2 ? 0.2 :
                        maxAbsContribution <= 0.5 ? 0.5 : 
                        maxAbsContribution <= 1 ? 1 :
                        Math.ceil(maxAbsContribution);
    
    // Set up the chart container for the contribution plot
    const chartWidth = chartContainer.clientWidth;
    const midpoint = chartWidth / 2; // Represents 0 on the x-axis
    const axisMargin = 10; // margin from edges to allow labels
    
    // Function to convert a contribution value to bar width (always positive length)
    const valueToWidth = (value) => {
        const scale = (midpoint - axisMargin) / niceMaxValue;
        return Math.abs(value) * scale;
    };
    
    // Create a vertical zero line in the middle
    const zeroLine = document.createElement('div');
    zeroLine.style.position = 'absolute';
    zeroLine.style.top = '0';
    zeroLine.style.bottom = '0';
    zeroLine.style.width = '1px';
    zeroLine.style.backgroundColor = '#000';
    zeroLine.style.left = `${midpoint}px`;
    zeroLine.style.zIndex = '2';
    chartContainer.appendChild(zeroLine);
    
    // Iterate through all contributions and create rows
    allContributions.forEach((item, index) => {
        // Create feature label row
        const featureLabel = document.createElement('div');
        featureLabel.className = 'feature-label';
        
        const featureName = document.createElement('div');
        featureName.className = 'feature-name';
        featureName.textContent = item.featureKey;
        
        const featureValue = document.createElement('div');
        featureValue.className = 'feature-value';
        featureValue.textContent = item.value;
        
        featureLabel.appendChild(featureName);
        featureLabel.appendChild(featureValue);
        chartContainer.appendChild(featureLabel);
        
        // Create contribution bar row
        const barRow = document.createElement('div');
        barRow.className = 'contribution-waterfall';
        
        // Add horizontal axis line inside each row for context (optional)
        const axisLine = document.createElement('div');
        axisLine.className = 'line-axis';
        barRow.appendChild(axisLine);
        
        if (item.contribution !== 0) {
            // Ensure minimum bar width for visibility of very small values
            // Subtract 15px from width for the arrow/triangle that will be added via CSS
            const triangleSize = 15;
            // Calculate raw width, then account for the triangle
            const rawBarWidth = Math.max(valueToWidth(item.contribution), 40);
            const barWidth = Math.max(rawBarWidth - triangleSize, 40);
            
            const isEarthSample = item.contribution > 0; // Positive = Earth (blue)
            const bar = document.createElement('div');
            bar.className = `contribution-bar ${isEarthSample ? 'contribution-positive' : 'contribution-negative'}`;
            bar.style.width = `${barWidth}px`;
            
            // For positive values, position normally from midpoint
            // For negative values, shift left by the bar width plus arrowhead
            bar.style.left = isEarthSample ? `${midpoint}px` : `${midpoint - barWidth}px`;
            
            // Format the coefficient with appropriate precision:
            // For very small values, show more decimal places
            const absValue = Math.abs(item.contribution);
            let formattedValue;
            if (absValue < 0.01) {
                formattedValue = item.contribution.toFixed(4);
            } else if (absValue < 0.1) {
                formattedValue = item.contribution.toFixed(3);
            } else {
                formattedValue = item.contribution.toFixed(2);
            }
            
            // Add + sign for positive values
            if (item.contribution > 0) {
                formattedValue = '+' + formattedValue;
            }
            
            bar.textContent = formattedValue;
            
            barRow.appendChild(bar);
        }
        
        chartContainer.appendChild(barRow);
        
        // Add to contribution table
        const direction = item.contribution >= 0 ? 'Earth Sample (+)' : 'Meteorite (-)';
        const percentImpact = (Math.abs(item.contribution) / totalAbsContribution * 100).toFixed(2);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.featureKey}</td>
            <td>${item.contribution.toFixed(6)}</td>
            <td>${percentImpact}%</td>
            <td>${direction}</td>
        `;
        contributionTable.appendChild(row);
    });
    
    /* ------------ X-Axis (Numeric) ------------- */
    const axisContainer = document.createElement('div');
    axisContainer.style.position = 'relative';
    axisContainer.style.height = '25px';
    axisContainer.style.marginTop = '8px';
    
    // Horizontal line
    const horizAxis = document.createElement('div');
    horizAxis.style.position = 'absolute';
    horizAxis.style.top = '12px';
    horizAxis.style.left = '0';
    horizAxis.style.right = '0';
    horizAxis.style.height = '1px';
    horizAxis.style.backgroundColor = '#000';
    axisContainer.appendChild(horizAxis);
    
    // Tick marks for axis
    const tickCount = 5; // Including min, 0, max
    const tickStep = niceMaxValue * 2 / (tickCount - 1);
    
    for (let i = 0; i < tickCount; i++) {
        const tickValue = -niceMaxValue + (i * tickStep);
        const xPercent = (i / (tickCount - 1)) * 100;
        
        // Draw tick mark
        const tick = document.createElement('div');
        tick.style.position = 'absolute';
        tick.style.top = '8px';
        tick.style.height = '8px';
        tick.style.width = '1px';
        tick.style.backgroundColor = '#000';
        tick.style.left = `${xPercent}%`;
        axisContainer.appendChild(tick);
        
        // Draw tick label
        const label = document.createElement('div');
        label.style.position = 'absolute';
        label.style.top = '0';
        label.style.transform = 'translateX(-50%)';
        label.style.left = `${xPercent}%`;
        label.style.fontSize = '12px';
        label.style.fontFamily = 'monospace';
        
        // Format tick labels based on their magnitude
        if (Math.abs(tickValue) < 0.01) {
            label.textContent = tickValue.toFixed(4);
        } else if (Math.abs(tickValue) < 0.1) {
            label.textContent = tickValue.toFixed(3);
        } else {
            label.textContent = tickValue.toFixed(2);
        }
        
        axisContainer.appendChild(label);
    }
    
    chartContainer.appendChild(axisContainer);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize buttons and load coefficients
    await initializeSampleButtons();
    await loadCoefficients();
    
    // Set up event listeners
    addFeatureBtn.addEventListener('click', addFeature);
    mzInput.addEventListener('keypress', e => { if (e.key === 'Enter') rt1Input.focus(); });
    rt1Input.addEventListener('keypress', e => { if (e.key === 'Enter') rt2Input.focus(); });
    rt2Input.addEventListener('keypress', e => { if (e.key === 'Enter') addFeature(); });
    runPredictionBtn.addEventListener('click', runLogisticRegression);
    
    // Validate tolerance inputs on blur
    [mzToleranceInput, rt1ToleranceInput, rt2ToleranceInput].forEach(input => {
        input.addEventListener('blur', () => {
            if (!isValidNumber(input.value) || parseFloat(input.value) < 0) {
                input.style.borderColor = 'red';
            } else {
                input.style.borderColor = '';
            }
        });
    });
    
    // Setup CSV drag and drop functionality
    const dropZone = document.getElementById('csv-drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    
    // Open file dialog when browse button is clicked
    browseBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    // Handle file selection from dialog
    fileInput.addEventListener('change', handleFileUpload);
    
    // Setup drag and drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('active');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('active');
        }, false);
    });
    
    // Handle the dropped file
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length) {
            handleCSVFile(files[0]);
        }
    });
    
    // Handle file from file input
    function handleFileUpload(e) {
        const files = e.target.files;
        if (files.length) {
            handleCSVFile(files[0]);
        }
    }
    
    // Process the CSV file
    function handleCSVFile(file) {
        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            alert('Please upload a CSV file');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const csvData = e.target.result;
                const lines = csvData.split('\n');
                let addedCount = 0;
                
                // Clear existing features
                features = [];
                featuresList.innerHTML = '';
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    
                    const values = line.split(',');
                    if (values.length < 3) continue;
                    
                    const mz = parseFloat(values[0]);
                    const rt1 = parseFloat(values[1]);
                    const rt2 = parseFloat(values[2]);
                    
                    if (isValidNumber(mz) && isValidNumber(rt1) && isValidNumber(rt2)) {
                        // Add feature using the shared function
                        addFeatureToList(mz, rt1, rt2);
                        addedCount++;
                    }
                }
                
                updateRunButtonState();
                alert(`Successfully added ${addedCount} features from the CSV file.`);
            } catch (error) {
                showError('Error processing CSV file', error);
            }
        };
        
        reader.onerror = function() {
            showError('Error reading the file', null);
        };
        
        reader.readAsText(file);
    }
}); 