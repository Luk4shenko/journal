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

    async function searchEmployee(field, query) {
        if (query.length < 3) {
            return; // слишком короткий запрос
        }
    
        try {
            const response = await fetch(`https://nn-app-020.stada.ru/StadaIdentityService/api/employee/s?search=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error(`Ошибка сети: ${response.status}`);
            }
    
            const data = await response.json();
            const results = data.map(employee => employee.fullName);
            
            updateSuggestions(field, results);
        } catch (error) {
            console.error('Ошибка при поиске сотрудников:', error);
        }
    }
    
    function updateSuggestions(field, suggestions) {
        const datalist = document.getElementById(`${field}List`);
        datalist.innerHTML = '';
    
        suggestions.forEach(suggestion => {
            const option = document.createElement('option');
            option.value = suggestion;
            datalist.appendChild(option);
        });
    }
    
    document.addEventListener('DOMContentLoaded', () => {
        const fullNameInput = document.getElementById('fullName');
        const issuedByInput = document.getElementById('issuedBy');
    
        const fullNameList = document.createElement('datalist');
        fullNameList.id = 'fullNameList';
        fullNameInput.setAttribute('list', 'fullNameList');
        document.body.appendChild(fullNameList);
    
        const issuedByList = document.createElement('datalist');
        issuedByList.id = 'issuedByList';
        issuedByInput.setAttribute('list', 'issuedByList');
        document.body.appendChild(issuedByList);
    });
    