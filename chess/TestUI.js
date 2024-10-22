import { tests, games } from "./Tests.js";
import { eventHub } from "./EventHub.js";

let selectedItem = null;
const reset = () => {
  eventHub.emit("resetButtonClicked");
};

function populateDropdown(dropdown, items, defaultText) {
  dropdown.innerHTML = ''; // Clear existing options
  
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = defaultText;
  dropdown.appendChild(defaultOption);

  items.forEach((item, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = item.title;
    dropdown.appendChild(option);
  });
}

function createControls() {
  const controlsDiv = document.getElementById('controls');

  const testDropdown = document.createElement('select');
  testDropdown.id = 'testDropdown';
  controlsDiv.appendChild(testDropdown);

  const gameDropdown = document.createElement('select');
  gameDropdown.id = 'gameDropdown';
  controlsDiv.appendChild(gameDropdown);

  const startSimulationButton = document.createElement('button');
  startSimulationButton.id = 'startSimulation';
  startSimulationButton.textContent = 'Start Simulation';
  controlsDiv.appendChild(startSimulationButton);
 
  const resetButton = document.createElement('button');
  resetButton.id = 'resetButton';
  resetButton.textContent = 'Reset';
  controlsDiv.appendChild(resetButton);
  resetButton.addEventListener("click", reset);

  populateDropdown(testDropdown, tests, "Tests");
  populateDropdown(gameDropdown, games, "Games");
  testDropdown.addEventListener('change', function() {
    if (this.value !== "") {
      selectedItem = tests[parseInt(this.value)];
      gameDropdown.value = ""; // Reset the other dropdown
    } else {
      selectedItem = null;
    }
  });

  gameDropdown.addEventListener('change', function() {
    if (this.value !== "") {
      selectedItem = games[parseInt(this.value)];
      testDropdown.value = ""; // Reset the other dropdown
    } else {
      selectedItem = null;
    }
  });
}

// Call this function when the page loads
document.addEventListener('DOMContentLoaded', function loadPage() {
  createControls();
  const startSimulationButton = document.getElementById("startSimulation");
  const resetButton = document.getElementById("resetButton");
  startSimulationButton.addEventListener("click", startSelectedItem);
  resetButton.addEventListener("click", reset);
});

function startSelectedItem() {
  if (selectedItem) {
    selectedItem.run(true);
  } else {
    console.log("Please select a test or game before starting the simulation.");
  }
}
