window.onload = function() {
    fetch('/getJournalTypes')
        .then(response => response.json())
        .then(data => {
            const journalTypesList = document.getElementById('journalTypesList');
            if (journalTypesList) {
                data.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type.name;
                    journalTypesList.appendChild(option);
                });
            }
        })
        .catch(error => console.error('Error fetching journal types:', error));

    fetch('/getMedicineTypes')
        .then(response => response.json())
        .then(data => {
            const medicineTypesList = document.getElementById('medicineTypesList');
            if (medicineTypesList) {
                data.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type.name;
                    medicineTypesList.appendChild(option);
                });
            }
        })
        .catch(error => console.error('Error fetching medicine types:', error));

    fetch('/predictNextJournalNumber')
        .then(response => response.text())
        .then(data => {
            const journalNumber = document.getElementById('journalNumber');
            if (journalNumber) {
                journalNumber.textContent = data;
            }
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
    if (datalist) {
        datalist.innerHTML = '';

        suggestions.forEach(suggestion => {
            const option = document.createElement('option');
            option.value = suggestion;
            datalist.appendChild(option);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const fullNameInput = document.getElementById('fullName');
    const issuedByInput = document.getElementById('issuedBy');

    if (fullNameInput) {
        const fullNameList = document.createElement('datalist');
        fullNameList.id = 'fullNameList';
        fullNameInput.setAttribute('list', 'fullNameList');
        document.body.appendChild(fullNameList);
    }

    if (issuedByInput) {
        const issuedByList = document.createElement('datalist');
        issuedByList.id = 'issuedByList';
        issuedByInput.setAttribute('list', 'issuedByList');
        document.body.appendChild(issuedByList);
    }
});

async function fetchFullName(username) {
    const numericPart = username.replace('sc', '').trim();
    if (!numericPart) {
        return null;
    }
    try {
        const response = await fetch(`https://nn-app-020.stada.ru/StadaIdentityService/api/employee/${numericPart}`);
        const data = await response.json();
        if (data && data.fullName) {
            return data.fullName;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Ошибка при выполнении запроса:', error);
        return null;
    }
}

async function validateUsername() {
    const usernameInput = document.getElementById('username');
    const usernameValue = usernameInput.value.trim();
    const fullNameInput = document.getElementById('fullNameInput');
    const hiddenFullNameInput = document.getElementById('hiddenFullName');

    // Проверяем, начинается ли имя пользователя с 'sc'
    if (!usernameValue.startsWith('sc')) {
        alert('Имя пользователя должно начинаться с "sc".');
        return false;
    }

    try {
        const fullName = await fetchFullName(usernameValue);
        if (fullNameInput) {
            fullNameInput.value = fullName || 'ФИО не найдено';
        }

        // Обновляем скрытое поле с ФИО
        if (hiddenFullNameInput) {
            hiddenFullNameInput.value = fullName || '';
        }
    } catch (error) {
        console.error('Ошибка при выполнении запроса:', error);
        fullNameInput.value = 'Ошибка при выполнении запроса';
    }

    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.addEventListener('blur', validateUsername);
    }
});

