// ---------- 1. FIND THE ELEMENTS ----------
// Same as before: grab the parts of the page we need to work with
const form = document.querySelector(".add-bar");            // the add form
const taskInput = document.querySelector(".task-input"); // the text box
const categorySelect = document.querySelector(".add-bar select"); // the dropdown
const taskList = document.querySelector(".task-list");      // the <ul> that holds the task cards
// The date picker. picks the input with that exact type.
const dueInput = document.querySelector(".due-input");
// ---------- 2. THE DATA ----------
// localStorage is a small storage space inside the browser that survives refreshes.
// It only stores text, so we saved the list as JSON text, and JSON.parse turns it back into a real list.
// "|| []" means: if nothing was saved yet (null), start with an empty list instead.
let tasks = JSON.parse(localStorage.getItem("tasks")) || [];

// The next id must be higher than any saved id, or new tasks could clash with old ones.
// Math.max(...) finds the biggest number. The "..." spreads the list out as separate values.
// If there are no tasks, start at 1.
let nextId = tasks.length > 0 ? Math.max(...tasks.map((t) => t.id)) + 1 : 1;

// Which sidebar category is selected right now. Starts on "All".
let currentCategory = "All";
// Which filter button is selected right now: "all", "active" or "completed"
let currentFilter = "all";
// The id of the task currently being edited. null means "nothing is being edited".
let editingId = null;
// How the tasks are sorted right now: "due", "newest" or "name"
let currentSort = "due";

// Saves the current tasks list into the browser's storage.
// JSON.stringify turns our list into text so it can be stored.
// SVG icons stored as text so we can drop them into the cards.
// class="icon" lets CSS size them. stroke="currentColor" makes them use the button's text color.
const PENCIL_ICON = `<svg class="icon" viewBox="0 0 24 24"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>`;
const TRASH_ICON = `<svg class="icon" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;
const CLOCK_ICON = `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

function saveTasks() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
}

// Turns a date string like "2026-11-08T09:00" into friendly text like "Nov 8, 9:00 AM"
// Turns a date string like "2026-11-08T09:00" into "Today, 9:00 AM", "Tomorrow, 9:00 AM",
// "Yesterday, 9:00 AM", or "Sat, Nov 8, 9:00 AM" for any other day
function formatDue(dueString) {

  // No date chosen
  if (!dueString) {
    return "No due date";
  }

  const date = new Date(dueString);

  // Today at midnight. setHours(0,0,0,0) sets hours, minutes, seconds, ms to zero,
  // so we compare whole DAYS and ignore the time of day.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // The due date, also at midnight
  const dueDay = new Date(date);
  dueDay.setHours(0, 0, 0, 0);

  // Difference in days. Dates subtract into milliseconds, and one day = 86,400,000 ms.
  // Math.round avoids tiny errors (like daylight saving changes).
  // 0 = today, 1 = tomorrow, -1 = yesterday
  const diffDays = Math.round((dueDay - today) / 86400000);

  // Just the time part, like "9:00 AM"
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Tomorrow, ${time}`;
  if (diffDays === -1) return `Yesterday, ${time}`;

  // Any other day: "Sat, Nov 29"
  const day = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `${day}, ${time}`;
}

// ---------- 3. THE RENDER FUNCTION ----------
// A function is a reusable block of code, like "def" in Python.
// render() clears the list on the page and redraws every task from the "tasks" list.
function render() {
   // Every change (add, delete, tick) calls render(), so saving here saves every change
  saveTasks();
  // Empty the <ul> so we don't draw tasks twice
    taskList.innerHTML = "";

  // Build a NEW list containing only the tasks we want to show.
  // filter() keeps a task only if the function returns true for it.
  const visibleTasks = tasks.filter((task) => {

    // Category check: show everything if "All" is selected, otherwise only matching categories
    const categoryMatch = currentCategory === "All" || task.category === currentCategory;

    // Filter check: start by assuming the task passes
    let filterMatch = true;
    if (currentFilter === "active") {
      // Active = not done yet. "!" means "not".
      filterMatch = !task.done;
    } else if (currentFilter === "completed") {
      // Completed = done
      filterMatch = task.done;
    }

    // && means AND: the task must pass BOTH checks to be shown
    return categoryMatch && filterMatch;

  });

  // Sort the visible tasks. filter() gave us a NEW list, so sorting it won't mess up the real "tasks" list.
  //
  // How .sort() works: you give it a function that compares two tasks, a and b.
  //   - return a NEGATIVE number  -> a goes BEFORE b
  //   - return a POSITIVE number  -> a goes AFTER b
  //   - return 0                  -> keep them as they are
  if (currentSort === "due") {
    visibleTasks.sort((a, b) => {

      // If neither task has a date, don't change their order
      if (!a.due && !b.due) return 0;

      // If only a has no date, put a AFTER b (positive). Tasks with no date go to the bottom.
      if (!a.due) return 1;

      // If only b has no date, put a BEFORE b (negative)
      if (!b.due) return -1;

      // Both have dates. Dates like "2026-11-08T09:00" sort correctly as plain text,
      // and localeCompare returns the negative/positive/zero that sort() needs.
      return a.due.localeCompare(b.due);
    });

  } else if (currentSort === "name") {
    // Alphabetical by task text
    visibleTasks.sort((a, b) => a.text.localeCompare(b.text));

  } else if (currentSort === "newest") {
    // Higher id = added later. b.id - a.id puts the biggest id first.
    visibleTasks.sort((a, b) => b.id - a.id);
  }
  // Loop through the visible tasks only (not the full list)
 visibleTasks.forEach((task) => {

    // Create a new <li> for this task, and give it the "task" class for styling
    const li = document.createElement("li");
    li.className = "task";

    // If this task is done, also add the "done" class
    if (task.done) {
      li.classList.add("done");
    }

        // If THIS task is the one being edited, draw an edit form instead of the normal card
    if (task.id === editingId) {

      // Edit version of the card: a text box, a date picker, and two buttons
      li.innerHTML = `
        <input type="text" class="edit-text">
        <input type="datetime-local" class="edit-due">
        <button class="save-btn">Save</button>
        <button class="cancel-btn">Cancel</button>
      `;

      // Find the two inputs inside this card
      const editText = li.querySelector(".edit-text");
      const editDue = li.querySelector(".edit-due");

      // Fill them with the task's current values.
      // We set .value in code (not in the HTML) so special characters can't break the page.
      editText.value = task.text;
      editDue.value = task.due || "";   // "|| ''" means: use an empty string if there's no date

      // A function for saving, so both the Save button and the Enter key can use it
      function saveEdit() {
        const newText = editText.value.trim();

        // A task needs a name, so ignore the save if the box is empty
        if (newText === "") {
          return;
        }

        // Update the real data
        task.text = newText;
        task.due = editDue.value;

        // Leave editing mode
        editingId = null;

        // Redraw (this also saves to localStorage)
        render();
      }

      // Save button click
      li.querySelector(".save-btn").addEventListener("click", saveEdit);

      // Cancel button: leave editing mode without changing any data
      li.querySelector(".cancel-btn").addEventListener("click", () => {
        editingId = null;
        render();
      });

      // Pressing Enter inside the text box also saves. e.key tells us which key was pressed.
      editText.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          saveEdit();
        }
      });

      // Put this edit card on the page
      taskList.appendChild(li);

      // "return" inside forEach means "skip to the next task". It's like "continue" in a Python loop.
      // Without it, the normal card code below would run too and overwrite our edit form.
      return;
    }

    // The HTML inside the card
        // The HTML inside the card
    li.innerHTML = `
        <input type="checkbox">
        <span class="tag">${task.category}</span>
        <div class="task-info">
          <span class="task-text"></span>
          <div class="due">${CLOCK_ICON}<span class="due-text"></span></div>
        </div>
        <button class="edit-btn" title="Edit">${PENCIL_ICON}</button>
        <button class="delete-btn" title="Delete">${TRASH_ICON}</button>
    `;

    // Put the task's text in safely (as plain text, not HTML)
    li.querySelector(".task-text").textContent = task.text;

        // Show the due date in friendly form
    li.querySelector(".due-text").textContent = formatDue(task.due);

    // --- The checkbox ---
    const checkbox = li.querySelector("input");
    checkbox.checked = task.done;

    checkbox.addEventListener("change", () => {
      task.done = checkbox.checked;
      render();
    });

    // --- The Delete button ---
    const deleteBtn = li.querySelector(".delete-btn");

    deleteBtn.addEventListener("click", () => {
      tasks = tasks.filter((t) => t.id !== task.id);
      render();
    });

        // --- The Edit button ---
    // Find the Edit button inside THIS card (we gave it class="edit-btn" in the card's HTML)
    const editBtn = li.querySelector(".edit-btn");

       editBtn.addEventListener("click", () => {
      // Remember which task we're editing, then redraw. render() will notice and show the edit form.
      editingId = task.id;
      render();
    });
    

    // Put the finished card on the page
    taskList.appendChild(li);
  });

  // Update the numbers in the sidebar every time we redraw (this is Edit C)
  updateCounts();
}
    

// ---------- 4. ADDING A TASK ----------
form.addEventListener("submit", (event) => {

  // Stop the form from reloading the page
  event.preventDefault();

  // Get what was typed (trim removes extra spaces) and the selected category
  const text = taskInput.value.trim();
  const category = categorySelect.value;

  // If the box is empty, do nothing
  if (text === "") {
    return;
  }

  // Add a new task to the list. {} is an object, like a dictionary in Python:
  // each task has an id, text, category, and whether it's done.
  tasks.push({
    id: nextId,
    text: text,
    category: category,
    due : dueInput.value, // the date the user picked (an empty string if they skipped it)
    done: false
  });

  // Increase the counter so the next task gets a different id (nextId++ means nextId = nextId + 1)
  nextId++;

  // Clear the text box
  taskInput.value = "";
  dueInput.value= "";

  // Redraw the page to show the new task
  render();
  //   // Update the numbers in the sidebar every time we redraw
  // updateCounts();
});

// ---------- UPDATE SIDEBAR COUNTS ----------
function updateCounts() {

  // querySelectorAll finds ALL matching elements (querySelector finds only the first one)
  const items = document.querySelectorAll(".sidebar li");

  // Go through each sidebar row
  items.forEach((item) => {

    // dataset reads the data-... labels. data-category="School" becomes item.dataset.category
    const category = item.dataset.category;

    let count;
    if (category === "All") {
      // All Tasks = the total number of tasks
      count = tasks.length;
    } else {
      // Otherwise, count only the tasks in this category. .length = how many items are in the list.
      count = tasks.filter((t) => t.category === category).length;
    }

    // Put the number into the little badge inside this row
    item.querySelector(".count").textContent = count;
  });

      // ---- Counts for the filter buttons ----

  // The "pool" is the tasks we count from: only the selected category, or everything if "All"
  const pool = currentCategory === "All"
    ? tasks
    : tasks.filter((t) => t.category === currentCategory);

  const filterButtons = document.querySelectorAll(".filters button");

  filterButtons.forEach((button) => {
    const filter = button.dataset.filter;

    let count;
    if (filter === "all") {
      count = pool.length;
    } else if (filter === "active") {
      count = pool.filter((t) => !t.done).length;
    } else {
      count = pool.filter((t) => t.done).length;
    }

    button.querySelector(".count").textContent = count;
  });
}

// ---------- SIDEBAR CLICKS ----------
document.querySelectorAll(".sidebar li").forEach((item) => {
  item.addEventListener("click", () => {

    // Remember which category was clicked
    currentCategory = item.dataset.category;

    // Remove the "active" class from every row...
    document.querySelectorAll(".sidebar li").forEach((li) => li.classList.remove("active"));
    // ...then add it to the one we clicked, so it's highlighted
    item.classList.add("active");

    // Redraw with the new category
    render();
  });
});

// ---------- FILTER BUTTON CLICKS ----------
document.querySelectorAll(".filters button").forEach((button) => {
  button.addEventListener("click", () => {

    // Remember which filter was clicked: "all", "active" or "completed"
    currentFilter = button.dataset.filter;

    // Highlight only the clicked button
    document.querySelectorAll(".filters button").forEach((b) => b.classList.remove("active"));
    button.classList.add("active");

    // Redraw with the new filter
    render();
  });
});

// ---------- SORT DROPDOWN ----------
document.querySelector(".sort-select").addEventListener("change", (e) => {
  // e.target is the dropdown itself, and .value is the option the user picked
  currentSort = e.target.value;

  // Redraw with the new order
  render();
});
// ---------- 5. FIRST DRAW ----------
// Draw the (empty) list when the page first loads
render();
