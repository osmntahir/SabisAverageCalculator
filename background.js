// Select all lesson cards
const lessonCards = document.querySelectorAll('.card-custom.card-stretch');

// Perform operations for each lesson card
lessonCards.forEach((card) => {
    // Find the success grade
    const successGradeCell = card.querySelector('.font-weight-bold');

    // Select the table containing the grades
    const gradeTable = card.querySelector('table');

    // Check for the average grade row
    let averageGradeRow = gradeTable.querySelector('.average-grade-row');

    // Calculate the average grade for display
    const displayAverageGrade = calculateDisplayAverageGrade(gradeTable);

    // Calculate the color score based on entered weights
    const colorScore = calculateColorScore(displayAverageGrade, gradeTable);

    // If the average grade row already exists, overwrite it
    if (averageGradeRow) {
        // Display the average grade
        averageGradeRow.innerHTML = `
            <td></td>
            <td class="font-weight-bold">Ortalama</td>
            <td class="text-right font-weight-bold">
                <span style="color: ${getColorForGrade(colorScore)}; font-weight: bold">${displayAverageGrade.toFixed(2)}</span>
            </td>
        `;
    } else {
        // Display the average grade
        averageGradeRow = document.createElement('tr');
        averageGradeRow.classList.add('average-grade-row');
        averageGradeRow.innerHTML = `
            <td></td>
            <td class="font-weight-bold">Ortalama</td>
            <td class="text-right font-weight-bold">
                <span style="color: ${getColorForGrade(colorScore)}; font-weight: bold">${displayAverageGrade.toFixed(2)}</span>
            </td>
        `;

        // Append the average grade row to the table
        gradeTable.querySelector('tbody').appendChild(averageGradeRow);
    }
});

// Function to calculate the displayed average grade based on entered grades
function calculateDisplayAverageGrade(gradeTable) {
    const gradeRows = gradeTable.querySelectorAll('tbody tr');
    let totalGrade = 0;
    let totalWeight = 0;

    gradeRows.forEach((row) => {
        const gradeText = row.querySelector('.text-right').textContent.trim();
        const grade = parseFloat(gradeText);
        const ratioText = row.querySelector('td:first-child').textContent.trim();
        const ratio = parseFloat(ratioText);

        if (!isNaN(grade)) {
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
        const gradeText = row.querySelector('.text-right').textContent.trim();
        const ratioText = row.querySelector('td:first-child').textContent.trim();
        const ratio = parseFloat(ratioText);

        if (!isNaN(parseFloat(gradeText))) {
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
