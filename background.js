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

    // If the average grade row already exists, overwrite it
    if (averageGradeRow) {
        // Calculate the average grade
        const averageGrade = calculateAverageGrade(gradeTable);

        // Display the average grade
        averageGradeRow.innerHTML = `
            <td></td>
            <td class="font-weight-bold">Ortalama</td>
            <td class="text-right font-weight-bold">
                <span style="color: ${getColorForGrade(averageGrade)}; font-weight: bold">${averageGrade.toFixed(2)}</span>
            </td>
        `;
    } else {
        // Calculate the average grade
        const averageGrade = calculateAverageGrade(gradeTable);

        // Display the average grade
        averageGradeRow = document.createElement('tr');
        averageGradeRow.classList.add('average-grade-row');
        averageGradeRow.innerHTML = `
            <td></td>
            <td class="font-weight-bold">Ortalama</td>
            <td class="text-right font-weight-bold">
                <span style="color: ${getColorForGrade(averageGrade)}; font-weight: bold">${averageGrade.toFixed(2)}</span>
            </td>
        `;

        // Append the average grade row to the table
        gradeTable.querySelector('tbody').appendChild(averageGradeRow);
    }
});

// Function to calculate the average grade
function calculateAverageGrade(gradeTable) {
    // Select all grade rows
    const gradeRows = gradeTable.querySelectorAll('tbody tr');

    // Variables to hold the total grade amount and the number of grades
    let totalGrade = 0;

    // Iterate over each grade row
    gradeRows.forEach((row) => {
        // Find and parse the grade
        const gradeText = row.querySelector('.text-right').textContent.trim();
        const grade = parseFloat(gradeText);
        
        // Find and parse the ratio
        const ratioText = row.querySelector('td:first-child').textContent.trim();
        const ratio = parseFloat(ratioText);

        // If the grade is a valid number and is a grade to be included in the average calculation
        if (!isNaN(grade)) {
            // Calculate the total grade
            totalGrade += (grade * ratio) / 100;
        }
    });

    // Calculate the average grade
    return totalGrade;
}

// Function to determine color based on grade
function getColorForGrade(grade) {
    return grade >= 70 ? 'green' : (grade >= 50 ? 'blue' : 'red');
}
