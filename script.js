document.addEventListener("DOMContentLoaded", () => {
  const dateSpan = document.getElementById("current-date");
  dateSpan.textContent = new Date().toLocaleDateString("uk-UA");

  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 6);
  document.getElementById("date-to").value = formatDateInput(today);
  document.getElementById("date-from").value = formatDateInput(weekAgo);

  let exchangeRates = [];
  let selectedCurrencyCode = null;

  fetch("https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json")
    .then((response) => response.json())
    .then((data) => {
      exchangeRates = data;
      renderCurrencyList(data);
      populateDatalist(data);
    })
    .catch((err) => console.error("Помилка завантаження даних:", err));

  function renderCurrencyList(data) {
    const list = document.getElementById("currency-list");
    list.innerHTML = "";

    data.forEach((currency) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${currency.cc} – ${currency.txt}</span>
        <span>${currency.rate.toFixed(2)} грн</span>
      `;

      li.addEventListener("click", () => {
        document
          .querySelectorAll(".currency-list li.selected")
          .forEach((el) => el.classList.remove("selected"));
        li.classList.add("selected");

        selectedCurrencyCode = currency.cc;

        loadHistoryFromDateRange(currency.cc);
      });

      list.appendChild(li);
    });
  }

  function populateDatalist(data) {
    const datalist = document.getElementById("currency-select");
    datalist.innerHTML = "";

    data.forEach((currency) => {
      const option = document.createElement("option");
      option.value = `${currency.cc} - ${currency.txt}`;
      option.setAttribute("data-rate", currency.rate);
      datalist.appendChild(option);
    });
  }

  const amountForeignInput = document.getElementById("amount-foreign");
  const currencyInputForeign = document.getElementById(
    "currency-input-foreign",
  );
  const amountUahResult = document.getElementById("amount-uah-result");

  const amountUahInput = document.getElementById("amount-uah");
  const currencyInputLocal = document.getElementById("currency-input-local");
  const amountForeignResult = document.getElementById("amount-foreign-result");

  function getRateFromDatalist(inputValue) {
    const option = document.querySelector(
      `#currency-select option[value="${inputValue}"]`,
    );
    return option ? parseFloat(option.getAttribute("data-rate")) : null;
  }

  function convertToUah() {
    const amount = parseFloat(amountForeignInput.value);
    const rate = getRateFromDatalist(currencyInputForeign.value);
    amountUahResult.value =
      !isNaN(amount) && rate ? (amount * rate).toFixed(2) : "";
  }

  function convertToForeign() {
    const amountUah = parseFloat(amountUahInput.value);
    const rate = getRateFromDatalist(currencyInputLocal.value);
    amountForeignResult.value =
      !isNaN(amountUah) && rate ? (amountUah / rate).toFixed(2) : "";
  }

  amountForeignInput.addEventListener("input", convertToUah);
  currencyInputForeign.addEventListener("change", convertToUah);
  amountUahInput.addEventListener("input", convertToForeign);
  currencyInputLocal.addEventListener("change", convertToForeign);

  function getLastNDates(n) {
    const dates = [];
    for (let i = 0; i < n; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(toNbuDateFormat(d));
    }
    return dates;
  }

  function toNbuDateFormat(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}${m}${d}`;
  }

  function formatDateInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function formatDateDisplay(nbuDate) {
    return `${nbuDate.slice(6, 8)}.${nbuDate.slice(4, 6)}.${nbuDate.slice(0, 4)}`;
  }

  function getDatesBetween(fromStr, toStr) {
    const dates = [];
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (from > to) return dates;

    const cur = new Date(to);
    while (cur >= from) {
      dates.push(toNbuDateFormat(cur));
      cur.setDate(cur.getDate() - 1);
    }
    return dates;
  }

  function setHistoryTitle(currencyCode) {
    document.getElementById("history-title").textContent =
      `Курс ${currencyCode} за вибраний період`;
  }

  async function fetchRates(valcode, date) {
    const url = `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=${valcode}&date=${date}&json`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      return data[0];
    } catch (err) {
      throw new Error(
        `Помилка запиту для ${valcode} на ${date}: ${err.message}`,
      );
    }
  }

  async function loadCurrencyHistory(currencyCode, dates) {
    const historyOutput = document.getElementById("history-output");
    historyOutput.innerHTML = `<p class="loading">Завантаження даних...</p>`;

    try {
      const promises = dates.map((date) => fetchRates(currencyCode, date));
      const results = await Promise.all(promises);

      const validResults = results.filter(Boolean);

      validResults.sort((a, b) => {
        return (
          parseInt(b.exchangedate.split(".").reverse().join("")) -
          parseInt(a.exchangedate.split(".").reverse().join(""))
        );
      });

      console.log("Отримані дані курсу:", validResults);

      renderHistoryTable(validResults, currencyCode);
    } catch (err) {
      console.error("Помилка завантаження історії:", err);
      historyOutput.innerHTML = `<p class="error">Помилка завантаження: ${err.message}</p>`;
    }
  }

  function renderHistoryTable(data, currencyCode) {
    const historyOutput = document.getElementById("history-output");
    historyOutput.innerHTML = "";

    if (!data.length) {
      historyOutput.innerHTML = `<p class="hint">Немає даних за вибраний період</p>`;
      return;
    }

    const table = document.createElement("table");
    table.className = "history-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>Дата</th>
          <th>Курс ${currencyCode}</th>
        </tr>
      </thead>
    `;

    const tbody = document.createElement("tbody");
    data.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${entry.exchangedate}</td>
        <td>${entry.rate.toFixed(2)} грн</td>
      `;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    historyOutput.appendChild(table);
  }

  function loadHistoryFromDateRange(currencyCode) {
    const fromValue = document.getElementById("date-from").value;
    const toValue = document.getElementById("date-to").value;

    let dates;
    if (fromValue && toValue) {
      dates = getDatesBetween(fromValue, toValue);
    } else {
      dates = getLastNDates(7);
    }

    setHistoryTitle(currencyCode);
    loadCurrencyHistory(currencyCode, dates);
  }

  document.getElementById("btn-load-range").addEventListener("click", () => {
    if (!selectedCurrencyCode) {
      document.getElementById("history-output").innerHTML =
        `<p class="hint">Спочатку виберіть валюту зі списку зліва</p>`;
      return;
    }
    loadHistoryFromDateRange(selectedCurrencyCode);
  });
});
