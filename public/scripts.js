// scripts.js
window.onload = function() {
    fetch('/getJournalTypes')
        .then(response => response.json())
        .then(data => {
            const journalTypesList = document.getElementById('journalTypesList');
            data.forEach(type => {
                const option = document.createElement('option');
                option.value = type.name;
                journalTypesList.appendChild(option);
            });
        })
        .catch(error => console.error('Error fetching journal types:', error));

    fetch('/getMedicineTypes')
        .then(response => response.json())
        .then(data => {
            const medicineTypesList = document.getElementById('medicineTypesList');
            data.forEach(type => {
                const option = document.createElement('option');
                option.value = type.name;
                medicineTypesList.appendChild(option);
            });
        })
        .catch(error => console.error('Error fetching medicine types:', error));

        fetch('/predictNextJournalNumber')
        .then(response => response.text())
        .then(data => {
            document.getElementById('journalNumber').textContent = data;
        })
        .catch(error => console.error('Error fetching next journal number:', error));
    };
