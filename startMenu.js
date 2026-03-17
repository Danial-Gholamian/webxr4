import { DATASETS } from "./dataset.js";

export function initStartMenu() {

  return new Promise((resolve) => {

    const startPanel = document.getElementById("startPanel");
    const datasetSelector = document.getElementById("datasetSelector");
    const startBtn = document.getElementById("startBtn");
    const deltaInput = document.getElementById("deltaInput");
    const usernameInput = document.getElementById("usernameInput")

    const datasetKeys = Object.keys(DATASETS);

    datasetKeys.forEach((key, index) => {

      const label = document.createElement("label");
      label.style.display = "block";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "dataset";
      radio.value = key;

      if (index === 0) radio.checked = true;

      label.appendChild(radio);
      label.append(" " + DATASETS[key].label);

      datasetSelector.appendChild(label);
    });

    const startApp = () => {
      const selectedDataset =
        document.querySelector('input[name="dataset"]:checked').value;

      const parsedDelta = parseFloat(deltaInput.value);
      const deltaMin = (!isNaN(parsedDelta) && parsedDelta > 0) ? parsedDelta : 50;
      const username = usernameInput.value.trim() || "Anonymous";

      startPanel.style.display = "none";

      resolve({
        datasetKey: selectedDataset,
        deltaMin: deltaMin,
        username
      });
    }

    startBtn.addEventListener("click", startApp)
    document.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        startApp();
      }
    })

  });
}