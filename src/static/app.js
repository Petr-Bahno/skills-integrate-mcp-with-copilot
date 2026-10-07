document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const activityFilterForm = document.getElementById("activity-filter-form");
  const messageDiv = document.getElementById("message");
  const activitySearch = document.getElementById("activity-search");
  const categoryFilter = document.getElementById("category-filter");
  const sortOrder = document.getElementById("sort-order");
  const activityCount = document.getElementById("activity-count");
  let allActivities = {};
  let submittedSearch = "";

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      if (!response.ok) {
        throw new Error("Failed to fetch activities");
      }

      allActivities = await response.json();
      const categories = [
        ...new Set(Object.values(allActivities).map((activity) => activity.category)),
      ].sort((left, right) => left.localeCompare(right));

      categoryFilter.replaceChildren(new Option("All categories", ""));
      categories.forEach((category) => {
        categoryFilter.add(new Option(category, category));
      });

      activitySelect.replaceChildren(new Option("-- Select an activity --", ""));
      Object.keys(allActivities).forEach((name) => {
        activitySelect.add(new Option(name, name));
      });

      renderActivities();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  function getStartTimeMinutes(schedule) {
    const match = schedule.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) {
      return null;
    }

    let hour = Number(match[1]) % 12;
    if (match[3].toUpperCase() === "PM") {
      hour += 12;
    }
    return hour * 60 + Number(match[2]);
  }

  function renderActivities() {
    const query = submittedSearch;
    const selectedCategory = categoryFilter.value;
    const [sortBy, direction] = sortOrder.value.split("-");
    const matchingActivities = Object.entries(allActivities).filter(
      ([name, details]) => {
        const matchesCategory =
          !selectedCategory || details.category === selectedCategory;
        const searchableText = `${name} ${details.description} ${details.schedule} ${details.category}`;
        return (
          matchesCategory &&
          searchableText.toLocaleLowerCase().includes(query)
        );
      }
    );

    matchingActivities.sort(([leftName, left], [rightName, right]) => {
      if (sortBy === "time") {
        const leftTime = getStartTimeMinutes(left.schedule);
        const rightTime = getStartTimeMinutes(right.schedule);
        if (leftTime === null && rightTime !== null) return 1;
        if (rightTime === null && leftTime !== null) return -1;
        if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
          return (leftTime - rightTime) * (direction === "desc" ? -1 : 1);
        }
      }
      return leftName.localeCompare(rightName, undefined, {
        sensitivity: "base",
      });
    });

    activityCount.textContent = `${matchingActivities.length} ${matchingActivities.length === 1 ? "activity" : "activities"} found`;
    activitiesList.replaceChildren();

    if (matchingActivities.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.textContent = "No activities match your filters.";
      activitiesList.appendChild(emptyMessage);
      return;
    }

    matchingActivities.forEach(([name, details]) => {
      const activityCard = document.createElement("div");
      activityCard.className = "activity-card";

      const spotsLeft = details.max_participants - details.participants.length;
      const participantsHTML =
        details.participants.length > 0
          ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
          : `<p><em>No participants yet</em></p>`;

      activityCard.innerHTML = `
        <h4>${name}</h4>
        <p class="activity-category">${details.category}</p>
        <p>${details.description}</p>
        <p><strong>Schedule:</strong> ${details.schedule}</p>
        <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
        <div class="participants-container">
          ${participantsHTML}
        </div>
      `;
      activitiesList.appendChild(activityCard);
    });

    document.querySelectorAll(".delete-btn").forEach((button) => {
      button.addEventListener("click", handleUnregister);
    });
  }

  activityFilterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submittedSearch = activitySearch.value.trim().toLocaleLowerCase();
    renderActivities();
  });
  categoryFilter.addEventListener("change", renderActivities);
  sortOrder.addEventListener("change", renderActivities);

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
