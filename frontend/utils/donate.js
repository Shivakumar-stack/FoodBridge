(() => {
  const TEMPLATE_STORAGE_KEY = "foodbridge_donation_template_v1";
  const DRAFT_STORAGE_KEY = "foodbridge_donation_draft_v1";
  const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
  const DONATION_ALLOWED_ROLES = new Set(["donor", "admin"]);
  const categoryOptions = [
    { value: "Cooked Food", label: "Cooked Food" },
    { value: "Raw Ingredients", label: "Raw Ingredients" },
    { value: "Packaged", label: "Packaged" },
    { value: "Baked Goods", label: "Baked Goods" },
    { value: "Beverages", label: "Beverages" },
    { value: "Dairy", label: "Dairy" },
    { value: "Fruits", label: "Fruits" },
    { value: "Vegetables", label: "Vegetables" },
    { value: "Other", label: "Other" },
  ];

  let currentStep = 1;
  let inventoryResizeFrame = null;
  const elements = {};
  const restrictionPopupState = {
    open: false,
    activeConfig: null,
    lastTrigger: null,
  };

  function getFieldValue(field) {
    return String(field?.value || "").trim();
  }

  function getLocalDateInputValue(date) {
    const safeDate = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000,
    );
    return safeDate.toISOString().slice(0, 16);
  }

  function getMinPickupDate() {
    const minDate = new Date();
    minDate.setMinutes(0, 0, 0);
    minDate.setHours(minDate.getHours() + 1);
    return minDate;
  }

  function setPickupMinTime() {
    if (!elements.pickupTimeInput) return;
    const minDate = getMinPickupDate();
    const minValue = getLocalDateInputValue(minDate);
    elements.pickupTimeInput.setAttribute("min", minValue);
    if (!elements.pickupTimeInput.value) return;
    const selectedDate = new Date(elements.pickupTimeInput.value);
    if (Number.isNaN(selectedDate.getTime()) || selectedDate < minDate) {
      elements.pickupTimeInput.value = minValue;
    }
  }

  function buildCategoryOptions(selectedValue = "") {
    const options = ['<option value="">Category</option>'];
    categoryOptions.forEach((option) => {
      const selected = option.value === selectedValue ? "selected" : "";
      options.push(
        `<option value="${option.value}" ${selected}>${option.label}</option>`,
      );
    });
    return options.join("");
  }

  function escapeAttribute(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function buildFoodItemRow(item = {}) {
    const row = document.createElement("div");
    row.className =
      "food-item-row bg-slate-50/80 rounded-2xl p-5 border border-gray-100 shadow-sm relative group animate-fadeIn";
    row.innerHTML = `
      <button type="button" class="remove-item absolute -top-2 -right-2 w-8 h-8 bg-white text-red-400 hover:text-red-600 rounded-full shadow-md border border-gray-100 transition-all flex items-center justify-center z-10 opacity-0 group-hover:opacity-100">
        <i class="fas fa-times text-xs"></i>
      </button>
      <div class="space-y-5">
        <div>
          <div class="flex justify-between items-center mb-1">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Food Item Name</label>
            <span class="smart-tag hidden text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100 uppercase tracking-tighter">
              <i class="fas fa-sparkles mr-0.5"></i> Smart Detected
            </span>
          </div>
          <input
            type="text"
            class="item-name-input w-full px-5 py-4 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400"
            placeholder="E.g. Samosas, Steamed Rice"
            required
            value="${escapeAttribute(item.itemName || item.name || "")}"
          />
        </div>
        <div class="grid grid-cols-12 gap-5">
          <div class="relative col-span-12 sm:col-span-6">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Category</label>
            <div class="relative">
              <select
                class="category-select w-full appearance-none px-5 py-4 bg-white/50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400"
                required
              >
                ${buildCategoryOptions(item.category || "")}
              </select>
              <i class="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none"></i>
            </div>
          </div>
          <div class="col-span-6 sm:col-span-3">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Quantity</label>
            <input
              type="number"
              step="0.01"
              class="w-full px-4 py-4 bg-white/50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400"
              placeholder="Qty"
              required
              value="${escapeAttribute(item.quantity || "")}"
            />
          </div>
          <div class="col-span-6 sm:col-span-3">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Unit</label>
            <input
              type="text"
              class="w-full px-4 py-4 bg-white/50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400"
              placeholder="Unit (e.g. kg)"
              required
              value="${escapeAttribute(item.unit || "")}"
            />
          </div>
        </div>
        
        <div class="mt-4 pt-4 border-t border-slate-100/60 border-dashed">
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <i class="fas fa-camera text-emerald-600 mr-1"></i>Food Item Photo (Optional)
          </label>
          <input type="file" accept="image/jpeg, image/png, image/webp"
            class="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border border-slate-200 file:text-xs file:font-semibold file:bg-white file:text-slate-700 hover:file:bg-slate-50 transition-colors cursor-pointer" />
          <p class="text-[10px] text-slate-400 mt-2">Select an image for Hugging Face analysis after submission.</p>
        </div>
      </div>
    `;

    // Smart Categorization Logic
    const nameInput = row.querySelector(".item-name-input");
    const categorySelect = row.querySelector(".category-select");
    const smartTag = row.querySelector(".smart-tag");

    const performSmartCategorization = () => {
      const name = nameInput.value.trim().toLowerCase();
      if (!name) {
        smartTag.classList.add("hidden");
        return;
      }

      // Only auto-select if user hasn't manually touched the category or it's currently empty
      if (!categorySelect.value || categorySelect.dataset.autoSelected === "true") {
        let detectedCategory = "";

        if (
          name.includes("rice") ||
          name.includes("curry") ||
          name.includes("meal") ||
          name.includes("pizza") ||
          name.includes("samosa") ||
          name.includes("cooked") ||
          name.includes("biryani") ||
          name.includes("pasta")
        ) {
          detectedCategory = "Cooked Food";
        } else if (
          name.includes("apple") ||
          name.includes("banana") ||
          name.includes("fruit") ||
          name.includes("mango") ||
          name.includes("orange")
        ) {
          detectedCategory = "Fruits";
        } else if (
          name.includes("tomato") ||
          name.includes("potato") ||
          name.includes("onion") ||
          name.includes("veg") ||
          name.includes("carrot") ||
          name.includes("cucumber")
        ) {
          detectedCategory = "Vegetables";
        } else if (
          name.includes("milk") ||
          name.includes("cheese") ||
          name.includes("paneer") ||
          name.includes("yogurt") ||
          name.includes("curd") ||
          name.includes("dairy")
        ) {
          detectedCategory = "Dairy";
        } else if (
          name.includes("bread") ||
          name.includes("cake") ||
          name.includes("biscuit") ||
          name.includes("cookie") ||
          name.includes("bun") ||
          name.includes("pastry")
        ) {
          detectedCategory = "Baked Goods";
        } else if (
          name.includes("juice") ||
          name.includes("water") ||
          name.includes("drink") ||
          name.includes("soda") ||
          name.includes("coke") ||
          name.includes("coffee") ||
          name.includes("tea")
        ) {
          detectedCategory = "Beverages";
        } else if (
          name.includes("flour") ||
          name.includes("dal") ||
          name.includes("lentil") ||
          name.includes("sugar") ||
          name.includes("salt") ||
          name.includes("oil") ||
          name.includes("raw") ||
          name.includes("wheat") ||
          name.includes("grain") ||
          name.includes("egg") ||
          name.includes("meat") ||
          name.includes("chicken") ||
          name.includes("beef") ||
          name.includes("fish") ||
          name.includes("pork")
        ) {
          detectedCategory = "Raw Ingredients";
        } else if (
          name.includes("packet") ||
          name.includes("chips") ||
          name.includes("can") ||
          name.includes("box") ||
          name.includes("sealed") ||
          name.includes("packaged")
        ) {
          detectedCategory = "Packaged";
        }

        if (detectedCategory && categorySelect.value !== detectedCategory) {
          categorySelect.value = detectedCategory;
          categorySelect.dataset.autoSelected = "true";
          smartTag.classList.remove("hidden");

          // Flash effect
          categorySelect.classList.add("ring-2", "ring-emerald-500", "bg-emerald-50");
          setTimeout(() => {
            categorySelect.classList.remove("ring-2", "ring-emerald-500", "bg-emerald-50");
          }, 2000);
        } else if (!detectedCategory && categorySelect.dataset.autoSelected === "true") {
          // If name changed to something unrecognized, don't necessarily clear it,
          // but we can hide the tag if it's no longer a strong match.
          // For simplicity, we just keep the last auto-selection but hide the tag.
          smartTag.classList.add("hidden");
        }
      }
    };

    nameInput.addEventListener("input", ui.debounce(performSmartCategorization, 300));
    categorySelect.addEventListener("change", () => {
      categorySelect.dataset.autoSelected = "false";
      smartTag.classList.add("hidden");
    });

    return row;

  }

  function getFoodRows() {
    return Array.from(
      elements.foodItemsContainer?.querySelectorAll(".food-item-row") || [],
    );
  }

  function updateInventoryScrollState({ scrollToLatest = false } = {}) {
    const container = elements.foodItemsContainer;
    if (!container) return;

    const rows = getFoodRows();
    const shouldScroll = rows.length >= 2;
    container.classList.toggle("scrollable-inventory", shouldScroll);

    // ── Update row-count badge ──
    const badge = document.getElementById("inventoryRowBadge");
    if (badge) {
      badge.textContent = String(rows.length);
      badge.style.display = rows.length >= 2 ? "" : "none";
    }

    if (!shouldScroll) {
      container.style.removeProperty("--inventory-scroll-max-height");
      container.scrollTop = 0;
      return;
    }

    requestAnimationFrame(() => {
      const currentRows = getFoodRows();
      if (currentRows.length < 2) {
        container.style.removeProperty("--inventory-scroll-max-height");
        container.scrollTop = 0;
        return;
      }

      // Lock the window to exactly ONE card height so each new row
      // fills the same slot and previous rows hide above the scroll boundary.
      const firstRow = currentRows[0];
      if (firstRow) {
        const rowRect = firstRow.getBoundingClientRect();
        // Container has padding: 8px top + 8px bottom = 16px vertical
        const containerPadV = 16;
        const visibleHeight = Math.ceil(rowRect.height + containerPadV);
        if (visibleHeight > 0) {
          container.style.setProperty(
            "--inventory-scroll-max-height",
            `${visibleHeight}px`,
          );
        }
      }

      if (scrollToLatest) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      }

      // Update the "items above" indicator after scroll settles
      setTimeout(updateAboveIndicator, 380);
    });
  }

  /**
   * Updates the #inventoryAboveHint pill to show how many rows
   * are hidden above the current scroll fold inside the container.
   * Also wires the pill's click to scroll back to the top.
   */
  function updateAboveIndicator() {
    const container = elements.foodItemsContainer;
    const hintEl   = document.getElementById("inventoryAboveHint");
    const textEl   = document.getElementById("inventoryAboveText");
    if (!hintEl || !container) return;

    if (!container.classList.contains("scrollable-inventory")) {
      hintEl.style.display = "none";
      return;
    }

    const scrollTop = container.scrollTop;
    const rows = getFoodRows();
    let hiddenAbove = 0;

    for (const row of rows) {
      // A row is "above" the fold if its bottom edge is above the visible area
      const rowBottom = row.offsetTop + row.offsetHeight;
      if (rowBottom <= scrollTop + 4) hiddenAbove++;
    }

    if (hiddenAbove > 0) {
      const label = hiddenAbove === 1
        ? "1 item above — scroll up to review"
        : `${hiddenAbove} items above — scroll up to review`;
      if (textEl) textEl.textContent = label;
      hintEl.style.display = "flex";
    } else {
      hintEl.style.display = "none";
    }
  }

  function reindexFoodRows({ scrollToLatest = false } = {}) {
    const rows = getFoodRows();
    rows.forEach((row, index) => {
      const inputs = row.querySelectorAll("input");
      const categorySelect = row.querySelector("select");
      if (inputs[0]) inputs[0].name = `items[${index}][itemName]`;
      if (categorySelect) categorySelect.name = `items[${index}][category]`;
      if (inputs[1]) inputs[1].name = `items[${index}][quantity]`;
      if (inputs[2]) inputs[2].name = `items[${index}][unit]`;
      if (inputs[3]) inputs[3].name = `items[${index}][image]`;
    });
    updateRemoveButtons();
    updateInventoryScrollState({ scrollToLatest });
  }

  function updateRemoveButtons() {
    const rows = getFoodRows();
    const isSingleRow = rows.length <= 1;
    rows.forEach((row) => {
      const removeBtn = row.querySelector(".remove-item");
      if (!removeBtn) return;
      removeBtn.classList.toggle("hidden", isSingleRow);
      removeBtn.disabled = isSingleRow;
    });
  }

  function estimateServingsFromQuantity(quantity, unit) {
    const text = String(unit || "").toLowerCase();
    const value = Number.parseFloat(quantity);
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (/kg|kilogram/.test(text)) return Math.round(value * 8);
    if (/(^|\s)g(ram)?(\s|$)/.test(text)) return Math.round((value / 1000) * 8);
    if (/l(itre|iter)?/.test(text)) return Math.round(value * 5);
    if (/ml/.test(text)) return Math.round((value / 1000) * 5);
    if (/tray|box|pack|packet|bag/.test(text)) return Math.round(value * 10);
    if (/plate|meal|serving|portion/.test(text)) return Math.round(value);
    return Math.round(value * 4);
  }

  function getFoodItems({ strict = false } = {}) {
    return getFoodRows()
      .map((row) => {
        const inputs = row.querySelectorAll("input");
        const categorySelect = row.querySelector("select");
        const itemName = getFieldValue(inputs[0]);
        const category = getFieldValue(categorySelect);
        const quantity = getFieldValue(inputs[1]);
        const unit = getFieldValue(inputs[2]);
        const hasAnyValue = Boolean(itemName || category || quantity || unit);
        if (!hasAnyValue) return null;
        if (strict && (!itemName || !category || !quantity || !unit))
          return null;
        return { itemName, category, quantity, unit };
      })
      .filter(Boolean);
  }

  function calculateEstimatedServings(items = []) {
    const estimated = items.reduce(
      (total, item) =>
        total + estimateServingsFromQuantity(item.quantity, item.unit),
      0,
    );
    if (estimated > 0) return estimated;
    return Math.max(items.length * 5, 0);
  }

  function updateImpactPreview() {
    if (
      !elements.impactMealsPreview ||
      !elements.impactItemsPreview ||
      !elements.impactPolicyHint
    )
      return;
    elements.impactPolicyHint.classList.remove("hidden");
    const items = getFoodItems({ strict: false });
    const servings = calculateEstimatedServings(items);
    elements.impactItemsPreview.textContent = String(items.length);
    elements.impactMealsPreview.textContent = String(servings);
    if (elements.impactMeals) {
      elements.impactMeals.textContent =
        (1200000 + servings).toLocaleString() + "+";
    }
    if (!items.length) {
      elements.impactPolicyHint.textContent =
        "Add food items to preview impact and improve volunteer matching.";
      return;
    }
    if (servings > 300) {
      elements.impactPolicyHint.textContent =
        "Large donation detected. Verified donors receive faster large-load assignment and flexible limits.";
      return;
    }
    if (servings > 120) {
      elements.impactPolicyHint.textContent =
        "Medium-large donation. Verification unlocks higher daily limits and priority pickup routing.";
      return;
    }
    elements.impactPolicyHint.textContent =
      "Great! Clear quantities help us optimize matching and reduce pickup delays.";
  }

  function setStep(step) {
    currentStep = step === 2 ? 2 : 1;
    const isStep1 = currentStep === 1;
    const isStep2 = currentStep === 2;
    if (elements.step1) elements.step1.classList.toggle("hidden", !isStep1);
    if (elements.step2) elements.step2.classList.toggle("hidden", !isStep2);
    if (elements.stepLabel)
      elements.stepLabel.textContent = `Step ${currentStep} of 2`;
    if (elements.stepProgress)
      elements.stepProgress.classList.toggle("w-full", isStep2);
    if (elements.stepProgress)
      elements.stepProgress.classList.toggle("w-1/2", isStep1);
    setTabState(elements.stepTab1, isStep1);
    setTabState(elements.stepTab2, isStep2);
  }

  function setTabState(tabButton, isActive) {
    if (!tabButton) return;
    tabButton.setAttribute("aria-selected", String(isActive));
    tabButton.classList.toggle("bg-emerald-50", isActive);
    tabButton.classList.toggle("text-emerald-700", isActive);
    tabButton.classList.toggle("border-emerald-200", isActive);
    tabButton.classList.toggle("bg-gray-50", !isActive);
    tabButton.classList.toggle("text-gray-500", !isActive);
    tabButton.classList.toggle("border-gray-200", !isActive);
  }

  function validateStepOne() {
    const rows = getFoodRows();
    let hasValidItem = false;
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const [nameInput, quantityInput] = row.querySelectorAll("input");
      const categorySelect = row.querySelector("select");
      const name = getFieldValue(nameInput);
      const category = getFieldValue(categorySelect);
      const quantity = getFieldValue(quantityInput);
      const hasAnyValue = Boolean(name || category || quantity);
      const shouldValidate = index === 0 || hasAnyValue;
      if (!shouldValidate) continue;
      if (!name) {
        nameInput?.focus();
        nameInput?.reportValidity();
        return false;
      }
      if (!category) {
        categorySelect?.focus();
        categorySelect?.reportValidity();
        return false;
      }
      if (!quantity) {
        quantityInput?.focus();
        quantityInput?.reportValidity();
        return false;
      }
      hasValidItem = true;
    }
    if (!hasValidItem) {
      ui.showAlert(
        "Add at least one complete food item before continuing.",
        "warning",
        elements.alertContainer,
      );
      return false;
    }
    return true;
  }

  function validateStepTwo() {
    const requiredFields = Array.from(
      elements.step2?.querySelectorAll(
        "input[required], select[required], textarea[required]",
      ) || [],
    );
    for (const field of requiredFields) {
      if (!field.checkValidity()) {
        field.focus();
        field.reportValidity();
        return false;
      }
    }
    return true;
  }

  function saveTemplate(items = getFoodItems({ strict: true })) {
    if (!items.length) return;
    const payload = {
      savedAt: new Date().toISOString(),
      foodItems: items.slice(0, 15),
    };
    try {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn("Unable to store donation template:", error);
    }
  }

  function loadTemplate() {
    try {
      const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.foodItems) || parsed.foodItems.length === 0)
        return null;
      return parsed.foodItems;
    } catch (error) {
      console.warn("Unable to parse donation template:", error);
      return null;
    }
  }

  function applyFoodItems(items) {
    const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
    elements.foodItemsContainer.innerHTML = "";
    if (!safeItems.length) {
      elements.foodItemsContainer.appendChild(buildFoodItemRow());
    } else {
      safeItems.forEach((item) => {
        elements.foodItemsContainer.appendChild(buildFoodItemRow(item));
      });
    }
    reindexFoodRows();
    updateImpactPreview();
  }

  function highlightPickupSlot(activeButton = null) {
    elements.pickupSlotButtons.forEach((button) => {
      const isActive = button === activeButton;
      // Active state: emerald background with white text
      button.classList.toggle("bg-emerald-600", isActive);
      button.classList.toggle("text-white", isActive);
      button.classList.toggle("border-emerald-600", isActive);
      button.classList.toggle("shadow-md", isActive);
      // Inactive state: restore original appearance
      button.classList.toggle("bg-white", !isActive);
      button.classList.toggle("text-slate-500", !isActive);
      button.classList.toggle("border-gray-200", !isActive);
      button.classList.toggle("shadow-sm", !isActive);
      // Remove conflicting hover classes when active
      button.classList.toggle("hover:border-emerald-500", !isActive);
      button.classList.toggle("hover:text-emerald-600", !isActive);
    });
  }

  function setPickupFromSlot(button) {
    if (!elements.pickupTimeInput || !button) return;
    const minDate = getMinPickupDate();
    const targetDate = new Date(minDate);
    const offsetHours = Number.parseInt(button.dataset.offsetHours || "", 10);
    const slot = button.dataset.slot || "";
    if (Number.isFinite(offsetHours)) {
      targetDate.setHours(targetDate.getHours() + Math.max(offsetHours - 1, 0));
    } else if (slot === "tomorrow-morning") {
      targetDate.setDate(targetDate.getDate() + 1);
      targetDate.setHours(10, 0, 0, 0);
    }
    if (targetDate < minDate) targetDate.setTime(minDate.getTime());
    elements.pickupTimeInput.value = getLocalDateInputValue(targetDate);
    highlightPickupSlot(button);
  }

  function addFoodItem() {
    const rows = getFoodRows();

    // ── Receding effect on the current last visible row ──
    if (rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      lastRow.classList.remove("receding");
      // Force a reflow so removing then re-adding the class re-triggers the animation
      void lastRow.offsetWidth;
      lastRow.classList.add("receding");
      lastRow.addEventListener("animationend", () => {
        lastRow.classList.remove("receding");
      }, { once: true });
    }

    // ── Build and append new row ──
    const newRow = buildFoodItemRow();
    newRow.classList.add("entering");
    elements.foodItemsContainer.appendChild(newRow);
    newRow.addEventListener("animationend", () => {
      newRow.classList.remove("entering");
    }, { once: true });

    // ── Bump the badge ──
    const badge = document.getElementById("inventoryRowBadge");
    if (badge) {
      badge.classList.remove("bump");
      void badge.offsetWidth;
      badge.classList.add("bump");
      badge.addEventListener("animationend", () => {
        badge.classList.remove("bump");
      }, { once: true });
    }

    reindexFoodRows({ scrollToLatest: true });
    updateImpactPreview();
    // Delay slightly so the scroll has settled before we count hidden rows
    setTimeout(updateAboveIndicator, 400);
  }

  function removeFoodItem(removeButton) {
    const row = removeButton?.closest(".food-item-row");
    if (!row) return;

    // ── Animate the row out before removing from DOM ──
    row.classList.add("removing");

    const doRemove = () => {
      if (row.parentNode) row.remove();
      if (!getFoodRows().length)
        elements.foodItemsContainer.appendChild(buildFoodItemRow());
      reindexFoodRows();
      updateImpactPreview();
      // Re-evaluate which rows are hidden above the fold after removal
      setTimeout(updateAboveIndicator, 60);
    };

    // Wait for the CSS animation to finish (280ms), then remove
    const animDuration = 290;
    const fallback = setTimeout(doRemove, animDuration);
    row.addEventListener("animationend", () => {
      clearTimeout(fallback);
      doRemove();
    }, { once: true });
  }

  function resetFormState() {
    elements.form?.reset();
    applyFoodItems([]);
    setPickupMinTime();
    setStep(1);
    highlightPickupSlot(null);
    if (elements.alertContainer) elements.alertContainer.innerHTML = "";
  }

  function getAuthContext() {
    const hasAuthService = typeof authService !== "undefined";
    const isLoggedIn = hasAuthService && authService.isLoggedIn();
    const user = isLoggedIn ? authService.getUser() || null : null;
    const role = String(user?.role || "").toLowerCase();
    return { hasAuthService, isLoggedIn, user, role };
  }

  function isDonationActionAllowed() {
    const auth = getAuthContext();
    if (!auth.isLoggedIn) return { allowed: false, type: "guest", ...auth };
    if (!DONATION_ALLOWED_ROLES.has(auth.role))
      return { allowed: false, type: "role", ...auth };
    return { allowed: true, type: "", ...auth };
  }

  function formatRoleLabel(role) {
    const map = {
      donor: "donor",
      admin: "admin",
      volunteer: "volunteer",
      ngo: "NGO",
    };
    return map[String(role || "").toLowerCase()] || "user";
  }

  function getFocusableElements(container) {
    if (!container) return [];
    return Array.from(
      container.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.classList.contains("hidden"));
  }

  function getDraftPayload() {
    if (!elements.form) return null;
    const payload = {
      savedAt: Date.now(),
      step: currentStep,
      items: getFoodItems({ strict: false }),
      address: getFieldValue(elements.form.querySelector('[name="address"]')),
      city: getFieldValue(elements.form.querySelector('[name="city"]')),
      state: getFieldValue(elements.form.querySelector('[name="state"]')),
      zip: getFieldValue(elements.form.querySelector('[name="zip"]')),
      pickupDatetime: getFieldValue(elements.pickupTimeInput),
      priority: getFieldValue(elements.form.querySelector('[name="priority"]')),
      notes: getFieldValue(elements.form.querySelector('[name="notes"]')),
    };

    const hasData =
      payload.items.length > 0 ||
      payload.address ||
      payload.city ||
      payload.zip ||
      payload.pickupDatetime ||
      payload.notes;
    return hasData ? payload : null;
  }

  function saveDraft() {
    const payload = getDraftPayload();
    if (!payload) return;
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn("Unable to save donation draft:", error);
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (error) {
      console.warn("Unable to clear donation draft:", error);
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const savedAt = Number(parsed?.savedAt);
      if (!Number.isFinite(savedAt)) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        return null;
      }
      if (Date.now() - savedAt > DRAFT_TTL_MS) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch (error) {
      console.warn("Unable to load donation draft:", error);
      return null;
    }
  }

  function applyDraft(draft) {
    if (!draft || typeof draft !== "object") return false;
    const safeItems = Array.isArray(draft.items)
      ? draft.items
      : Array.isArray(draft.foodItems)
        ? draft.foodItems
        : [];
    if (safeItems.length) applyFoodItems(safeItems);

    const fieldMap = {
      '[name="address"]': draft.address || draft.pickupAddress?.street,
      '[name="city"]': draft.city || draft.pickupAddress?.city,
      '[name="state"]': draft.state || draft.pickupAddress?.state,
      '[name="zip"]': draft.zip || draft.pickupAddress?.zipCode,
      '[name="priority"]': draft.priority || "medium",
      '[name="notes"]': draft.notes,
    };

    Object.entries(fieldMap).forEach(([selector, value]) => {
      const field = elements.form?.querySelector(selector);
      if (!field || !value) return;
      field.value = value;
    });

    if (
      elements.pickupTimeInput &&
      (draft.pickupDatetime || draft.pickup_datetime || draft.pickupTime)
    ) {
      elements.pickupTimeInput.value =
        draft.pickupDatetime || draft.pickup_datetime || draft.pickupTime;
    }

    setPickupMinTime();
    updateImpactPreview();
    setStep(Number(draft.step) === 2 ? 2 : 1);
    highlightPickupSlot(null);
    return true;
  }

  function restoreDraftIfAvailable() {
    const draft = loadDraft();
    if (!draft) return;
    if (!applyDraft(draft)) return;
    ui.showAlert(
      "Recovered your saved donation draft from this device.",
      "info",
      elements.alertContainer,
    );
  }

  function redirectWithDraft(targetPath) {
    saveDraft();
    sessionStorage.setItem("redirectAfterLogin", "donate.html");
    window.location.href = targetPath;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function buildPolicyMessage(error) {
    const base = String(
      error?.message || "Your current donor policy limits this submission.",
    );
    const details = error?.details || {};
    const policy = details?.policy || {};
    const parts = [base];
    if (Number.isFinite(policy.maxItems))
      parts.push(`Max items for your tier: ${policy.maxItems}.`);
    if (Number.isFinite(policy.maxDailyDonations))
      parts.push(`Daily limit: ${policy.maxDailyDonations} donation(s).`);
    if (details?.nextAllowedAt) {
      const nextWindow = formatDateTime(details.nextAllowedAt);
      if (nextWindow) parts.push(`You can submit again after ${nextWindow}.`);
    }
    return parts.join(" ");
  }

  function getRestrictionPopupConfig(type, context = {}) {
    if (type === "guest") {
      const actionLabel = context.actionLabel || "continue";
      return {
        iconClass: "fas fa-user-lock text-xl",
        title: `Log in to ${actionLabel}`,
        message:
          "You can browse and fill the form in guest mode, but a connected user account is required to continue.",
        primaryLabel: "Log In",
        primaryHref: "../pages/login.html",
        onPrimary: () => redirectWithDraft("../pages/login.html"),
        secondaryLabel: "Create Donor Account",
        secondaryHref: "signup.html?role=donor",
        onSecondary: () => redirectWithDraft("signup.html?role=donor"),
        dismissLabel: "Continue Browsing",
      };
    }

    if (type === "role") {
      return {
        iconClass: "fas fa-id-card text-xl",
        title: "Donor Access Required",
        message: `You are signed in as ${formatRoleLabel(context.role)}. Only donor or admin accounts can ${context.actionLabel || "perform this action"} on this page.`,
        primaryLabel: "Go to Dashboard",
        primaryHref: "../pages/dashboard-unified.html",
        secondaryLabel: "Create Donor Account",
        secondaryHref: "signup.html?role=donor",
        onSecondary: () => redirectWithDraft("signup.html?role=donor"),
        dismissLabel: "Continue Browsing",
      };
    }

    return {
      iconClass: "fas fa-circle-exclamation text-xl",
      title: "Donation Limit Reached",
      message: buildPolicyMessage(context.error),
      primaryLabel: "Review My Donations",
      primaryHref: "dashboard-unified.html",
      secondaryLabel: "Update Draft",
      secondaryHref: "#",
      onSecondary: () => closeRestrictionPopup(),
      dismissLabel: "Close",
    };
  }

  function openRestrictionPopup(config, trigger = null) {
    if (!elements.authOverlay || !elements.restrictionDialog || !config) return;
    restrictionPopupState.activeConfig = config;
    restrictionPopupState.lastTrigger = trigger || document.activeElement;
    restrictionPopupState.open = true;

    if (elements.restrictionTitle)
      elements.restrictionTitle.textContent =
        config.title || "Restricted action";
    if (elements.restrictionMessage) {
      elements.restrictionMessage.textContent =
        config.message || "Please connect your account to continue.";
    }
    if (elements.restrictionIcon)
      elements.restrictionIcon.className =
        config.iconClass || "fas fa-lock text-xl";

    if (elements.authPrimaryAction) {
      elements.authPrimaryAction.textContent =
        config.primaryLabel || "Continue";
      elements.authPrimaryAction.href = config.primaryHref || "#";
    }

    if (elements.authSecondaryAction) {
      const hasSecondary = Boolean(config.secondaryLabel);
      elements.authSecondaryAction.classList.toggle("hidden", !hasSecondary);
      if (hasSecondary) {
        elements.authSecondaryAction.textContent = config.secondaryLabel;
        elements.authSecondaryAction.href = config.secondaryHref || "#";
      }
    }

    if (elements.authDismissAction) {
      elements.authDismissAction.textContent = config.dismissLabel || "Close";
    }

    elements.authOverlay.classList.remove("hidden");
    elements.authOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");

    window.setTimeout(() => {
      const focusables = getFocusableElements(elements.restrictionDialog);
      if (focusables.length) focusables[0].focus();
      else elements.restrictionDialog.focus();
    }, 20);
  }

  function closeRestrictionPopup() {
    if (!elements.authOverlay) return;
    elements.authOverlay.classList.add("hidden");
    elements.authOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
    restrictionPopupState.open = false;
    restrictionPopupState.activeConfig = null;
    const lastTrigger = restrictionPopupState.lastTrigger;
    if (lastTrigger && typeof lastTrigger.focus === "function")
      lastTrigger.focus();
    restrictionPopupState.lastTrigger = null;
  }

  function handleRestrictionAction(event, actionType) {
    const config = restrictionPopupState.activeConfig;
    if (!config) return;
    if (actionType === "primary" && typeof config.onPrimary === "function") {
      event.preventDefault();
      config.onPrimary();
      return;
    }
    if (
      actionType === "secondary" &&
      typeof config.onSecondary === "function"
    ) {
      event.preventDefault();
      config.onSecondary();
      return;
    }
    closeRestrictionPopup();
  }

  function trapPopupFocus(event) {
    if (!restrictionPopupState.open || event.key !== "Tab") return;
    const focusables = getFocusableElements(elements.restrictionDialog);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function bindRestrictionPopupEvents() {
    elements.authOverlayClose?.addEventListener("click", closeRestrictionPopup);
    elements.authDismissAction?.addEventListener(
      "click",
      closeRestrictionPopup,
    );

    elements.authOverlay?.addEventListener("click", (event) => {
      if (event.target === elements.authOverlay) closeRestrictionPopup();
    });

    elements.authPrimaryAction?.addEventListener("click", (event) => {
      handleRestrictionAction(event, "primary");
    });

    elements.authSecondaryAction?.addEventListener("click", (event) => {
      handleRestrictionAction(event, "secondary");
    });

    document.addEventListener("keydown", (event) => {
      if (!restrictionPopupState.open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRestrictionPopup();
        return;
      }
      trapPopupFocus(event);
    });
  }

  function ensureActionAccess(actionLabel, triggerElement = null) {
    const access = isDonationActionAllowed();
    if (access.allowed) return true;
    openRestrictionPopup(
      getRestrictionPopupConfig(access.type, {
        actionLabel,
        role: access.role,
      }),
      triggerElement,
    );
    return false;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (
      !ensureActionAccess(
        "submit donation",
        event.submitter || elements.submitBtn,
      )
    )
      return;

    if (!validateStepOne()) {
      setStep(1);
      return;
    }

    setStep(2);
    if (!validateStepTwo()) return;

    const submitBtn = elements.submitBtn;
    ui.setButtonLoading(submitBtn, true);

    const items = getFoodItems({ strict: true });
    
    // Create FormData for multipart upload
    const donationData = new FormData();
    donationData.append('items', JSON.stringify(items));
    donationData.append('address', getFieldValue(elements.form.querySelector('[name="address"]')));
    donationData.append('city', getFieldValue(elements.form.querySelector('[name="city"]')));
    donationData.append('state', getFieldValue(elements.form.querySelector('[name="state"]')));
    donationData.append('zip', getFieldValue(elements.form.querySelector('[name="zip"]')));
    donationData.append('pickupDatetime', getFieldValue(elements.pickupTimeInput));
    donationData.append('priority', getFieldValue(elements.form.querySelector('[name="priority"]')) || "medium");
    donationData.append('notes', getFieldValue(elements.form.querySelector('[name="notes"]')));
    donationData.append('impact[estimatedServings]', calculateEstimatedServings(items));

    // Append individual item images
    const itemImageInputs = elements.form.querySelectorAll('input[type="file"][name^="items["]');
    itemImageInputs.forEach(input => {
      if (input.files && input.files.length > 0) {
        donationData.append(input.name, input.files[0]);
      }
    });

    // Backward compatibility if there's a global image input
    const globalImageInput = elements.form.querySelector('input[type="file"][name="image"]');
    if (globalImageInput && globalImageInput.files.length > 0) {
      donationData.append('image', globalImageInput.files[0]);
    }

    const lat = getFieldValue(elements.latInput);
    const lng = getFieldValue(elements.lngInput);
    if (lat && lng) {
      donationData.append('lat', lat);
      donationData.append('lng', lng);
    }

    try {
      const response = await donationService.create(donationData);
      
      // Cache successful coordinates for this address
      if (response?.data?.lat && response?.data?.lng) {
        const address = getFieldValue(elements.form.querySelector('[name="address"]'));
        const city = getFieldValue(elements.form.querySelector('[name="city"]'));
        if (address && city) {
          const cacheKey = `coords_cache_${address.toLowerCase()}_${city.toLowerCase()}`;
          localStorage.setItem(cacheKey, JSON.stringify({ 
            lat: response.data.lat, 
            lng: response.data.lng,
            timestamp: Date.now()
          }));
          console.log("[Cache] Saved coordinates for future use at this address");
        }
      }

      saveTemplate(items);
      clearDraft();
      elements.successModal?.classList.remove("hidden");
      resetFormState();
    } catch (error) {
      console.error("Donation submission error:", error);
      if (error?.code === "DONOR_POLICY_LIMIT") {
        openRestrictionPopup(
          getRestrictionPopupConfig("policy", { error }),
          submitBtn,
        );
      }
      ui.showAlert(
        error?.message || "Failed to submit donation. Please try again.",
        error?.code === "DONOR_POLICY_LIMIT" ? "warning" : "error",
        elements.alertContainer,
      );
    } finally {
      ui.setButtonLoading(submitBtn, false);
    }
  }

  function bindEvents() {
    elements.addFoodItemBtn?.addEventListener("click", addFoodItem);

    elements.foodItemsContainer?.addEventListener("click", (event) => {
      const removeButton = event.target.closest(".remove-item");
      if (removeButton) removeFoodItem(removeButton);
    });

    elements.foodItemsContainer?.addEventListener("input", updateImpactPreview);
    elements.foodItemsContainer?.addEventListener(
      "change",
      updateImpactPreview,
    );

    // ── Update "items above" pill on every scroll inside the container ──
    elements.foodItemsContainer?.addEventListener("scroll", updateAboveIndicator, { passive: true });

    // ── Clicking the pill scrolls the container back to the top ──
    document.getElementById("inventoryAboveHint")?.addEventListener("click", () => {
      elements.foodItemsContainer?.scrollTo({ top: 0, behavior: "smooth" });
    });

    window.addEventListener("resize", () => {
      if (inventoryResizeFrame) cancelAnimationFrame(inventoryResizeFrame);
      inventoryResizeFrame = requestAnimationFrame(() => {
        inventoryResizeFrame = null;
        updateInventoryScrollState();
        updateAboveIndicator();
      });
    });

    elements.nextToStep2Btn?.addEventListener("click", () => {
      if (!validateStepOne()) return;
      saveTemplate(getFoodItems({ strict: true }));
      setStep(2);
    });

    elements.backToStep1Btn?.addEventListener("click", () => setStep(1));
    elements.stepTab1?.addEventListener("click", () => setStep(1));
    elements.stepTab2?.addEventListener("click", () => {
      if (!validateStepOne()) return;
      setStep(2);
    });

    elements.loadTemplateBtn?.addEventListener("click", () => {
      const template = loadTemplate();
      if (!template) {
        ui.showAlert(
          "No saved template found yet. Submit one donation to reuse details.",
          "info",
          elements.alertContainer,
        );
        return;
      }
      applyFoodItems(template);
      ui.showAlert(
        "Saved template loaded successfully.",
        "success",
        elements.alertContainer,
      );
    });

    elements.pickupSlotButtons.forEach((button) => {
      button.addEventListener("click", () => setPickupFromSlot(button));
    });

    elements.pickupTimeInput?.addEventListener("change", () => {
      highlightPickupSlot(null);
    });

    elements.form?.addEventListener("submit", handleSubmit);

    // Manual Coordinates Toggle
    elements.toggleManualCoords?.addEventListener("click", () => {
      const isHidden = elements.manualCoordsSection.classList.contains("hidden");
      elements.manualCoordsSection.classList.toggle("hidden", !isHidden);
      const label = elements.toggleManualCoords.querySelector("#manualCoordsLabel");
      if (label) {
        label.textContent = isHidden ? "Use automatic geocoding (Standard)" : "Set coordinates manually (Offline fallback)";
      }
    });

    // Cached Coordinates Logic
    const addressFields = ["address", "city", "zip"];
    addressFields.forEach(fieldName => {
      const field = elements.form.querySelector(`[name="${fieldName}"]`);
      field?.addEventListener("blur", () => {
        const address = getFieldValue(elements.form.querySelector('[name="address"]'));
        const city = getFieldValue(elements.form.querySelector('[name="city"]'));
        if (address && city) {
          const cacheKey = `coords_cache_${address.toLowerCase()}_${city.toLowerCase()}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached && !elements.latInput.value && !elements.lngInput.value) {
            try {
              const { lat, lng } = JSON.parse(cached);
              elements.latInput.value = lat;
              elements.lngInput.value = lng;
              console.log("[Cache] Pre-populated coordinates from previous donation at this address");
              
              // Show section if coordinates found in cache
              elements.manualCoordsSection.classList.remove("hidden");
              const label = elements.toggleManualCoords.querySelector("#manualCoordsLabel");
              if (label) label.textContent = "Using cached coordinates (Precise)";
            } catch (e) {
              console.warn("[Cache] Failed to parse cached coordinates", e);
            }
          }
        }
      });
    });

    elements.successModal?.addEventListener("click", (event) => {
      if (event.target.id === "successModal") {
        elements.successModal.classList.add("hidden");
      }
    });

    // Impact Calculator
    const updateImpactCalculator = (amount) => {
      const meals = Math.floor(amount / 2.5);
      if (elements.impactCalculatorAmount) {
        elements.impactCalculatorAmount.textContent = amount;
      }
      if (elements.impactCalculatorMeals) {
        elements.impactCalculatorMeals.textContent = meals;
      }
      if (elements.impactCalculatorSlider) {
        elements.impactCalculatorSlider.value = amount;
      }
      elements.impactPresetBtns.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.amount === String(amount));
      });
    };

    if (elements.impactCalculatorSlider) {
      elements.impactCalculatorSlider.addEventListener("input", (e) => {
        updateImpactCalculator(e.target.value);
      });
    }

    elements.impactPresetBtns.forEach((button) => {
      button.addEventListener("click", (e) => {
        const amount = e.target.dataset.amount;
        updateImpactCalculator(amount);
      });
    });
  }

  function cacheElements() {
    elements.form = document.getElementById("donationForm");
    elements.alertContainer = document.getElementById("alertContainer");
    elements.successModal = document.getElementById("successModal");
    elements.foodItemsContainer = document.getElementById("foodItemsContainer");
    elements.addFoodItemBtn = document.getElementById("addFoodItem");
    elements.loadTemplateBtn = document.getElementById("loadTemplateBtn");
    elements.nextToStep2Btn = document.getElementById("nextToStep2");
    elements.backToStep1Btn = document.getElementById("backToStep1");
    elements.submitBtn = document.getElementById("submitBtn");
    elements.stepLabel = document.getElementById("formStepLabel");
    elements.stepProgress = document.getElementById("formStepProgress");
    elements.stepTab1 = document.getElementById("stepTab1");
    elements.stepTab2 = document.getElementById("stepTab2");
    elements.step1 = document.getElementById("donationStep1");
    elements.step2 = document.getElementById("donationStep2");
    elements.pickupTimeInput = document.getElementById("pickupTimeInput");
    elements.pickupSlotButtons = Array.from(
      document.querySelectorAll(".pickup-slot-btn"),
    );
    elements.impactMealsPreview = document.getElementById("impactMealsPreview");
    elements.impactItemsPreview = document.getElementById("impactItemsPreview");
    elements.impactPolicyHint = document.getElementById("impactPolicyHint");
    elements.impactMeals = document.getElementById("impactMeals");

    // Impact Calculator
    elements.impactCalculatorSlider = document.getElementById(
      "impact-calculator-slider",
    );
    elements.impactCalculatorAmount = document.getElementById(
      "impact-calculator-amount",
    );
    elements.impactCalculatorMeals = document.getElementById(
      "impact-calculator-meals",
    );
    elements.impactPresetBtns = document.querySelectorAll(".impact-preset-btn");

    elements.authOverlay = document.getElementById("authOverlay");
    elements.restrictionDialog = document.getElementById(
      "donationRestrictionDialog",
    );
    elements.restrictionTitle = document.getElementById(
      "donationRestrictionTitle",
    );
    elements.restrictionMessage = document.getElementById(
      "donationRestrictionMessage",
    );
    elements.restrictionIcon = document.getElementById(
      "donationRestrictionIcon",
    );
    elements.authPrimaryAction = document.getElementById("authPrimaryAction");
    elements.authSecondaryAction = document.getElementById(
      "authSecondaryAction",
    );
    elements.authDismissAction = document.getElementById("authDismissAction");
    elements.authOverlayClose = document.getElementById("authOverlayClose");
    
    // Manual Coordinates
    elements.toggleManualCoords = document.getElementById("toggleManualCoords");
    elements.manualCoordsSection = document.getElementById("manualCoordsSection");
    elements.latInput = document.querySelector('input[name="lat"]');
    elements.lngInput = document.querySelector('input[name="lng"]');
  }

  function initFormRows() {
    elements.foodItemsContainer.innerHTML = "";
    elements.foodItemsContainer?.appendChild(buildFoodItemRow());
    reindexFoodRows();
  }

  function init() {
    cacheElements();
    if (!elements.form || !elements.foodItemsContainer) return;
    initFormRows();
    setPickupMinTime();
    updateImpactPreview();
    setStep(1);
    bindRestrictionPopupEvents();
    restoreDraftIfAvailable();
    bindEvents();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
