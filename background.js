// Select all lesson cards
const lessonCards = document.querySelectorAll('.card-custom.card-stretch');

// Perform operations for each lesson card
lessonCards.forEach((card) => {
    // Select the table containing the grades
    const gradeTable = card.querySelector('table');

    // Add input fields for empty grade cells
    const gradeRows = gradeTable.querySelectorAll('tbody tr');
    gradeRows.forEach((row) => {
        const gradeCell = row.querySelector('.text-right');
        if (!gradeCell.textContent.trim()) {
            gradeCell.innerHTML = `
                <input type="number" class="grade-input" placeholder="Not Gir" style="width: 60px; text-align: right;">
            `;
        }
    });

    // Function to update average grade dynamically
    const updateAverageGrade = () => {
        const displayAverageGrade = calculateDisplayAverageGrade(gradeTable);
        const colorScore = calculateColorScore(displayAverageGrade, gradeTable);

        // Check if the average grade row exists
        let averageGradeRow = gradeTable.querySelector('.average-grade-row');
        if (!averageGradeRow) {
            averageGradeRow = document.createElement('tr');
            averageGradeRow.classList.add('average-grade-row');
            gradeTable.querySelector('tbody').appendChild(averageGradeRow);
        }

        // Update the average grade row
        averageGradeRow.innerHTML = `
            <td></td>
            <td class="font-weight-bold">Ortalama</td>
            <td class="text-right font-weight-bold">
                <span style="color: ${getColorForGrade(colorScore)}; font-weight: bold">${displayAverageGrade.toFixed(2)}</span>
            </td>
        `;
    };

    // Add event listener to recalculate grades when input values change
    const gradeInputs = gradeTable.querySelectorAll('.grade-input');
    gradeInputs.forEach((input) => {
        input.addEventListener('input', () => {
            updateAverageGrade();
        });
    });

    // Initial calculation
    updateAverageGrade();
});

// Function to calculate the displayed average grade based on entered grades
function calculateDisplayAverageGrade(gradeTable) {
    const gradeRows = gradeTable.querySelectorAll('tbody tr');
    let totalGrade = 0;
    let totalWeight = 0;

    gradeRows.forEach((row) => {
        const gradeCell = row.querySelector('.text-right');
        const gradeInput = gradeCell.querySelector('.grade-input');
        const gradeText = gradeInput ? gradeInput.value.trim() : gradeCell.textContent.trim();
        const grade = parseFloat(gradeText);
        const ratioText = row.querySelector('td:first-child').textContent.trim();
        const ratio = parseFloat(ratioText);

        if (!isNaN(grade) && !isNaN(ratio)) {
            totalGrade += (grade * ratio) / 100;
            totalWeight += ratio;
        }
    });

    return totalWeight > 0 ? totalGrade : 0; // Avoid division by zero
}

// Function to calculate the color score based on the formula
function calculateColorScore(calculatedGrade, gradeTable) {
    const gradeRows = gradeTable.querySelectorAll('tbody tr');
    let totalWeight = 0;

    gradeRows.forEach((row) => {
        const gradeCell = row.querySelector('.text-right');
        const gradeInput = gradeCell.querySelector('.grade-input');
        const gradeText = gradeInput ? gradeInput.value.trim() : gradeCell.textContent.trim();
        const ratioText = row.querySelector('td:first-child').textContent.trim();
        const ratio = parseFloat(ratioText);

        if (!isNaN(parseFloat(gradeText)) && !isNaN(ratio)) {
            totalWeight += ratio;
        }
    });

    // Apply the color score formula
    return totalWeight > 0 ? (calculatedGrade * 100) / totalWeight : 0;
}

// Function to determine color based on the color score
function getColorForGrade(colorScore) {
    if (colorScore > 75) {
        return 'green'; // High score range
    } else if (colorScore >= 55) {
        return 'blue'; // Medium-high score range
    } else {
        return 'red'; // Low score range
    }
}
