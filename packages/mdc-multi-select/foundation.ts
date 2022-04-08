import { MDCFoundation } from '@material/base/foundation';
import { Corner } from '@material/menu-surface/constants';
import { KEY, normalizeKey } from '@material/dom/keyboard';
import { MDCSelectFoundationMap, MDCSelectIconFoundation, MDCSelectHelperTextFoundation } from "@material/select";
import { MDCMultiSelectAdapter } from './adapter';
import { cssClasses, numbers, strings } from './constants';

function indexEquals(a: number[], b: number[]) {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

export class MDCMultiSelectFoundation extends MDCFoundation<MDCMultiSelectAdapter> {
  static override get cssClasses() {
    return cssClasses;
  }

  static override get numbers() {
    return numbers;
  }

  static override get strings() {
    return strings;
  }

  /**
   * See {@link MDCSelectAdapter} for typing information on parameters and return types.
   */
  static override get defaultAdapter(): MDCMultiSelectAdapter {
    return {
      addClass: () => undefined,
      removeClass: () => undefined,
      hasClass: () => false,
      activateBottomLine: () => undefined,
      deactivateBottomLine: () => undefined,
      getSelectedIndex: () => [],
      setSelectedIndex: () => undefined,
      hasLabel: () => false,
      floatLabel: () => undefined,
      getLabelWidth: () => 0,
      setLabelRequired: () => undefined,
      hasOutline: () => false,
      notchOutline: () => undefined,
      closeOutline: () => undefined,
      setRippleCenter: () => undefined,
      notifyChange: () => undefined,
      setSelectedText: () => undefined,
      isSelectAnchorFocused: () => false,
      getSelectAnchorAttr: () => '',
      setSelectAnchorAttr: () => undefined,
      removeSelectAnchorAttr: () => undefined,
      addMenuClass: () => undefined,
      removeMenuClass: () => undefined,
      openMenu: () => undefined,
      closeMenu: () => undefined,
      getAnchorElement: () => null,
      setMenuAnchorElement: () => undefined,
      setMenuAnchorCorner: () => undefined,
      setMenuWrapFocus: () => undefined,
      focusMenuItemAtIndex: () => undefined,
      getMenuItemCount: () => 0,
      getMenuItemValues: () => [],
      getMenuItemTextAtIndex: () => '',
      isTypeaheadInProgress: () => false,
      typeaheadMatchItem: () => -1,
    };
    // tslint:enable:object-literal-sort-keys
  }

  private readonly leadingIcon: MDCSelectIconFoundation | undefined;
  private readonly helperText: MDCSelectHelperTextFoundation | undefined;

  // Disabled state
  private disabled = false;
  // isMenuOpen is used to track the state of the menu by listening to the
  // MDCMenuSurface:closed event For reference, menu.open will return false if
  // the menu is still closing, but isMenuOpen returns false only after the menu
  // has closed
  private isMenuOpen = false;
  // By default, select is invalid if it is required but no value is selected.
  private useDefaultValidation = true;
  private customValidity = true;
  private lastSelectedIndex: number[] = [];

  private clickDebounceTimeout = 0;
  private recentlyClicked = false;

  /* istanbul ignore next: optional argument is not a branch statement */
  /**
   * @param adapter
   * @param foundationMap Map from subcomponent names to their subfoundations.
   */
  constructor(adapter?: Partial<MDCMultiSelectAdapter>, foundationMap: Partial<MDCSelectFoundationMap> = {}) {
    super({ ...MDCMultiSelectFoundation.defaultAdapter, ...adapter });

    this.leadingIcon = foundationMap.leadingIcon;
    this.helperText = foundationMap.helperText;
  }

  /** Returns the index of the currently selected menu item, or [] if none. */
  getSelectedIndex(): number[] {
    return this.adapter.getSelectedIndex();
  }

  setSelectedIndex(index: number[], closeMenu = false, skipNotify = false) {
    const count = this.adapter.getMenuItemCount();
    if (index.some(i => i >= count)) {
      return;
    }

    if (index.length === 0) {
      this.adapter.setSelectedText('');
    } else {
      const text = index.map(i => this.adapter.getMenuItemTextAtIndex(i).trim()).join(', ');
      this.adapter.setSelectedText(text);
    }

    this.adapter.setSelectedIndex(index);

    if (closeMenu) {
      this.adapter.closeMenu();
    }

    if (!(skipNotify || indexEquals(this.lastSelectedIndex, index))) {
      this.handleChange();
    }

    this.lastSelectedIndex = index;
  }

  setValue(value: string[], skipNotify = false) {
    const newIndex: number[] = [];
    const menuItemValues = this.adapter.getMenuItemValues();

    for (const it of value) {
      const idx = menuItemValues.indexOf(it);
      if (idx >= 0) {
        newIndex.push(idx);
      }
    }

    this.setSelectedIndex(newIndex, /** closeMenu */ false, skipNotify);
  }

  getValue() {
    const index = this.adapter.getSelectedIndex();
    const menuItemValues = this.adapter.getMenuItemValues();
    return index.map(i => menuItemValues[i]);
  }

  getDisabled() {
    return this.disabled;
  }

  setDisabled(isDisabled: boolean) {
    this.disabled = isDisabled;
    if (this.disabled) {
      this.adapter.addClass(cssClasses.DISABLED);
      this.adapter.closeMenu();
    } else {
      this.adapter.removeClass(cssClasses.DISABLED);
    }

    if (this.leadingIcon) {
      this.leadingIcon.setDisabled(this.disabled);
    }

    if (this.disabled) {
      // Prevent click events from focusing select. Simply pointer-events: none
      // is not enough since screenreader clicks may bypass this.
      this.adapter.removeSelectAnchorAttr('tabindex');
    } else {
      this.adapter.setSelectAnchorAttr('tabindex', '0');
    }

    this.adapter.setSelectAnchorAttr('aria-disabled', this.disabled.toString());
  }

  /** Opens the menu. */
  openMenu() {
    this.adapter.addClass(cssClasses.ACTIVATED);
    this.adapter.openMenu();
    this.isMenuOpen = true;
    this.adapter.setSelectAnchorAttr('aria-expanded', 'true');
  }

  /**
   * @param content Sets the content of the helper text.
   */
  setHelperTextContent(content: string) {
    if (this.helperText) {
      this.helperText.setContent(content);
    }
  }

  /**
   * Re-calculates if the notched outline should be notched and if the label
   * should float.
   */
  layout() {
    if (this.adapter.hasLabel()) {
      const optionHasValue = this.getValue().length > 0;
      const isFocused = this.adapter.hasClass(cssClasses.FOCUSED);
      const shouldFloatAndNotch = optionHasValue || isFocused;
      const isRequired = this.adapter.hasClass(cssClasses.REQUIRED);

      this.notchOutline(shouldFloatAndNotch);
      this.adapter.floatLabel(shouldFloatAndNotch);
      this.adapter.setLabelRequired(isRequired);
    }
  }

  /**
   * Synchronizes the list of options with the state of the foundation. Call
   * this whenever menu options are dynamically updated.
   */
  layoutOptions() {
    const menuItemValues = this.adapter.getMenuItemValues();
    const selectedIndex = this.adapter.getSelectedIndex();
    this.setSelectedIndex(selectedIndex.filter(i => i >= 0 && i < menuItemValues.length),
            /** closeMenu */ false, /** skipNotify */ true);
  }

  handleMenuOpened() {
    const menuItemValues = this.adapter.getMenuItemValues();
    if (menuItemValues.length === 0) {
      return;
    }

    // Menu should open to the last selected element, should open to first menu item otherwise.
    const selectedIndex = this.adapter.getSelectedIndex();
    const focusItemIndex = Math.max(0, ...selectedIndex);
    this.adapter.focusMenuItemAtIndex(focusItemIndex);
  }

  handleMenuClosing() {
    this.adapter.setSelectAnchorAttr('aria-expanded', 'false');
  }

  handleMenuClosed() {
    this.adapter.removeClass(cssClasses.ACTIVATED);
    this.isMenuOpen = false;

    // Unfocus the select if menu is closed without a selection
    if (!this.adapter.isSelectAnchorFocused()) {
      this.blur();
    }
  }

  /**
   * Handles value changes, via change event or programmatic updates.
   */
  handleChange() {
    this.layout();
    this.adapter.notifyChange(this.getValue());

    const isRequired = this.adapter.hasClass(cssClasses.REQUIRED);
    if (isRequired && this.useDefaultValidation) {
      this.setValid(this.isValid());
    }
  }

  handleMenuItemAction(index: number) {
    const selectedIndex = new Set<number>(this.adapter.getSelectedIndex());
    if (!selectedIndex.delete(index)) {
      selectedIndex.add(index);
    }

    this.setSelectedIndex([...selectedIndex], /** closeMenu */ true);
  }

  /**
   * Handles focus events from select element.
   */
  handleFocus() {
    this.adapter.addClass(cssClasses.FOCUSED);
    this.layout();

    this.adapter.activateBottomLine();
  }

  /**
   * Handles blur events from select element.
   */
  handleBlur() {
    if (this.isMenuOpen) {
      return;
    }
    this.blur();
  }

  handleClick(normalizedX: number) {
    if (this.disabled || this.recentlyClicked) {
      return;
    }

    this.setClickDebounceTimeout();

    if (this.isMenuOpen) {
      this.adapter.closeMenu();
      return;
    }

    this.adapter.setRippleCenter(normalizedX);

    this.openMenu();
  }

  /**
   * Handles keydown events on select element. Depending on the type of
   * character typed, does typeahead matching or opens menu.
   */
  handleKeydown(event: KeyboardEvent) {
    if (this.isMenuOpen || !this.adapter.hasClass(cssClasses.FOCUSED)) {
      return;
    }

    const isEnter = normalizeKey(event) === KEY.ENTER;
    const isSpace = normalizeKey(event) === KEY.SPACEBAR;
    const arrowUp = normalizeKey(event) === KEY.ARROW_UP;
    const arrowDown = normalizeKey(event) === KEY.ARROW_DOWN;
    const isModifier = event.ctrlKey || event.metaKey;
    // Typeahead
    if (!isModifier &&
      (!isSpace && event.key && event.key.length === 1 ||
        isSpace && this.adapter.isTypeaheadInProgress())) {
      const key = isSpace ? ' ' : event.key;

      const selectedIndex = this.adapter.getSelectedIndex();
      const typeaheadNextIndex = this.adapter.typeaheadMatchItem(key, Math.max(-1, ...selectedIndex));
      if (typeaheadNextIndex >= 0 && selectedIndex.indexOf(typeaheadNextIndex) < 0) {
        this.setSelectedIndex([...selectedIndex, typeaheadNextIndex]);
      }
      event.preventDefault();
      return;
    }

    if (!isEnter && !isSpace && !arrowUp && !arrowDown) {
      return;
    }

    this.openMenu();
    event.preventDefault();
  }

  /**
   * Opens/closes the notched outline.
   */
  notchOutline(openNotch: boolean) {
    if (!this.adapter.hasOutline()) {
      return;
    }
    const isFocused = this.adapter.hasClass(cssClasses.FOCUSED);

    if (openNotch) {
      const labelScale = numbers.LABEL_SCALE;
      const labelWidth = this.adapter.getLabelWidth() * labelScale;
      this.adapter.notchOutline(labelWidth);
    } else if (!isFocused) {
      this.adapter.closeOutline();
    }
  }

  /**
   * Sets the aria label of the leading icon.
   */
  setLeadingIconAriaLabel(label: string) {
    if (this.leadingIcon) {
      this.leadingIcon.setAriaLabel(label);
    }
  }

  /**
   * Sets the text content of the leading icon.
   */
  setLeadingIconContent(content: string) {
    if (this.leadingIcon) {
      this.leadingIcon.setContent(content);
    }
  }

  getUseDefaultValidation(): boolean {
    return this.useDefaultValidation;
  }

  setUseDefaultValidation(useDefaultValidation: boolean) {
    this.useDefaultValidation = useDefaultValidation;
  }

  setValid(isValid: boolean) {
    if (!this.useDefaultValidation) {
      this.customValidity = isValid;
    }

    this.adapter.setSelectAnchorAttr('aria-invalid', (!isValid).toString());
    if (isValid) {
      this.adapter.removeClass(cssClasses.INVALID);
      this.adapter.removeMenuClass(cssClasses.MENU_INVALID);
    } else {
      this.adapter.addClass(cssClasses.INVALID);
      this.adapter.addMenuClass(cssClasses.MENU_INVALID);
    }

    this.syncHelperTextValidity(isValid);
  }

  isValid() {
    if (this.useDefaultValidation &&
      this.adapter.hasClass(cssClasses.REQUIRED) &&
      !this.adapter.hasClass(cssClasses.DISABLED)) {
      // See notes for required attribute under https://www.w3.org/TR/html52/sec-forms.html#the-select-element
      // TL;DR: Invalid if no index is selected, or if the first index is selected and has an empty value.
      const selectedIndex = this.adapter.getSelectedIndex();
      if (selectedIndex.length === 0) {
        return false;
      }

      const menuItemValues = this.adapter.getMenuItemValues();
      return selectedIndex.some(i => Boolean(menuItemValues[i]));
    }

    return this.customValidity;
  }

  setRequired(isRequired: boolean) {
    if (isRequired) {
      this.adapter.addClass(cssClasses.REQUIRED);
    } else {
      this.adapter.removeClass(cssClasses.REQUIRED);
    }
    this.adapter.setSelectAnchorAttr('aria-required', isRequired.toString());
    this.adapter.setLabelRequired(isRequired);
  }

  getRequired() {
    return this.adapter.getSelectAnchorAttr('aria-required') === 'true';
  }

  override init() {
    const anchorEl = this.adapter.getAnchorElement();
    if (anchorEl) {
      this.adapter.setMenuAnchorElement(anchorEl);
      this.adapter.setMenuAnchorCorner(Corner.BOTTOM_START);
    }
    this.adapter.setMenuWrapFocus(false);

    this.setDisabled(this.adapter.hasClass(cssClasses.DISABLED));
    this.syncHelperTextValidity(!this.adapter.hasClass(cssClasses.INVALID));
    this.layout();
    this.layoutOptions();
  }

  /**
   * Unfocuses the select component.
   */
  private blur() {
    this.adapter.removeClass(cssClasses.FOCUSED);
    this.layout();
    this.adapter.deactivateBottomLine();

    const isRequired = this.adapter.hasClass(cssClasses.REQUIRED);
    if (isRequired && this.useDefaultValidation) {
      this.setValid(this.isValid());
    }
  }

  private syncHelperTextValidity(isValid: boolean) {
    if (!this.helperText) {
      return;
    }

    this.helperText.setValidity(isValid);

    const helperTextVisible = this.helperText.isVisible();
    const helperTextId = this.helperText.getId();

    if (helperTextVisible && helperTextId) {
      this.adapter.setSelectAnchorAttr(strings.ARIA_DESCRIBEDBY, helperTextId);
    } else {
      // Needed because screenreaders will read labels pointed to by
      // `aria-describedby` even if they are `aria-hidden`.
      this.adapter.removeSelectAnchorAttr(strings.ARIA_DESCRIBEDBY);
    }
  }

  private setClickDebounceTimeout() {
    clearTimeout(this.clickDebounceTimeout);
    this.clickDebounceTimeout = window.setTimeout(() => {
      this.recentlyClicked = false;
    }, numbers.CLICK_DEBOUNCE_TIMEOUT_MS);
    this.recentlyClicked = true;
  }
}
