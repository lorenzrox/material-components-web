import MDCComponent from "@material/base/component";
import { CustomEventListener, SpecificEventListener } from "@material/base/types";
import { MDCFloatingLabel, MDCFloatingLabelFactory } from "@material/floating-label/component";
import { MDCLineRipple, MDCLineRippleFactory } from "@material/line-ripple/component";
import { MDCMenu, MDCMenuFactory } from "@material/menu/component";
import { MDCMenuItemEvent } from "@material/menu/types";
import { MDCNotchedOutline, MDCNotchedOutlineFactory } from "@material/notched-outline/component";
import { MDCSelectFoundationMap, MDCSelectHelperText, MDCSelectHelperTextFactory, MDCSelectIcon, MDCSelectIconFactory } from "@material/select";
import { cssClasses, strings } from "./constants";
import { MDCMultiSelectFoundation } from "./foundation";
import * as menuSurfaceConstants from '@material/menu-surface/constants';
import * as menuConstants from '@material/menu/constants';
import { MDCRipple } from '@material/ripple/component';
import { MDCMultiSelectAdapter } from "./adapter";
import { MDCRippleAdapter } from "@material/ripple/adapter";
import MDCRippleFoundation from "@material/ripple/foundation";
import { MDCMultiSelectEventDetail } from "./types";

export class MDCMultiSelect extends MDCComponent<MDCMultiSelectFoundation> {
    static override attachTo(root: Element): MDCMultiSelect {
        return new MDCMultiSelect(root);
    }

    private ripple!: MDCRipple | null;

    private menu!: MDCMenu;  // assigned in menuSetup()

    private selectAnchor!: HTMLElement;       // assigned in initialize()
    private selectedText!: HTMLElement;       // assigned in initialize()

    private menuElement!: Element;                  // assigned in menuSetup()
    private menuItemValues!: string[];              // assigned in menuSetup()
    private leadingIcon?: MDCSelectIcon;            // assigned in initialize()
    private helperText!: MDCSelectHelperText | null;  // assigned in initialize()
    private lineRipple!: MDCLineRipple | null;        // assigned in initialize()
    private label!: MDCFloatingLabel | null;          // assigned in initialize()
    private outline!: MDCNotchedOutline | null;       // assigned in initialize()

    // Event handlers
    private handleFocus!: SpecificEventListener<'focus'>;
    private handleBlur!: SpecificEventListener<'blur'>;
    private handleClick!: SpecificEventListener<'click'>;
    private handleKeydown!: SpecificEventListener<'keydown'>;
    private handleMenuOpened!: EventListener;
    private handleMenuClosed!: EventListener;
    private handleMenuClosing!: EventListener;
    private handleMenuItemAction!: CustomEventListener<MDCMenuItemEvent>;

    override initialize(
        labelFactory: MDCFloatingLabelFactory = (el) => new MDCFloatingLabel(el),
        lineRippleFactory: MDCLineRippleFactory = (el) => new MDCLineRipple(el),
        outlineFactory: MDCNotchedOutlineFactory = (el) => new MDCNotchedOutline(el),
        menuFactory: MDCMenuFactory = (el) => new MDCMenu(el),
        iconFactory: MDCSelectIconFactory = (el) => new MDCSelectIcon(el),
        helperTextFactory: MDCSelectHelperTextFactory = (el) => new MDCSelectHelperText(el),
    ) {
        this.selectAnchor =
            this.root.querySelector(strings.SELECT_ANCHOR_SELECTOR) as HTMLElement;
        this.selectedText =
            this.root.querySelector(strings.SELECTED_TEXT_SELECTOR) as HTMLElement;

        if (!this.selectedText) {
            throw new Error(
                'MDCMultiSelect: Missing required element: The following selector must be present: ' +
                `'${strings.SELECTED_TEXT_SELECTOR}'`,
            );
        }

        if (this.selectAnchor.hasAttribute(strings.ARIA_CONTROLS)) {
            const helperTextElement = document.getElementById(
                this.selectAnchor.getAttribute(strings.ARIA_CONTROLS)!);
            if (helperTextElement) {
                this.helperText = helperTextFactory(helperTextElement);
            }
        }

        this.menuSetup(menuFactory);

        const labelElement = this.root.querySelector(strings.LABEL_SELECTOR);
        this.label = labelElement ? labelFactory(labelElement) : null;

        const lineRippleElement =
            this.root.querySelector(strings.LINE_RIPPLE_SELECTOR);
        this.lineRipple =
            lineRippleElement ? lineRippleFactory(lineRippleElement) : null;

        const outlineElement = this.root.querySelector(strings.OUTLINE_SELECTOR);
        this.outline = outlineElement ? outlineFactory(outlineElement) : null;

        const leadingIcon = this.root.querySelector(strings.LEADING_ICON_SELECTOR);
        if (leadingIcon) {
            this.leadingIcon = iconFactory(leadingIcon);
        }

        if (!this.root.classList.contains(cssClasses.OUTLINED)) {
            this.ripple = this.createRipple();
        }
    }

    /**
     * Initializes the select's event listeners and internal state based
     * on the environment's state.
     */
    override initialSyncWithDOM() {
        this.handleFocus = () => {
            this.foundation.handleFocus();
        };
        this.handleBlur = () => {
            this.foundation.handleBlur();
        };
        this.handleClick = (evt) => {
            this.selectAnchor.focus();
            this.foundation.handleClick(this.getNormalizedXCoordinate(evt));
        };
        this.handleKeydown = (evt) => {
            this.foundation.handleKeydown(evt);
        };
        this.handleMenuItemAction = (evt) => {
            this.foundation.handleMenuItemAction(evt.detail.index);
        };
        this.handleMenuOpened = () => {
            this.foundation.handleMenuOpened();
        };
        this.handleMenuClosed = () => {
            this.foundation.handleMenuClosed();
        };
        this.handleMenuClosing = () => {
            this.foundation.handleMenuClosing();
        };

        this.selectAnchor.addEventListener('focus', this.handleFocus);
        this.selectAnchor.addEventListener('blur', this.handleBlur);

        this.selectAnchor.addEventListener(
            'click', this.handleClick as EventListener);

        this.selectAnchor.addEventListener('keydown', this.handleKeydown);
        this.menu.listen(
            menuSurfaceConstants.strings.CLOSED_EVENT, this.handleMenuClosed);
        this.menu.listen(
            menuSurfaceConstants.strings.CLOSING_EVENT, this.handleMenuClosing);
        this.menu.listen(
            menuSurfaceConstants.strings.OPENED_EVENT, this.handleMenuOpened);
        this.menu.listen(
            menuConstants.strings.SELECTED_EVENT, this.handleMenuItemAction);
    }

    override destroy() {
        this.selectAnchor.removeEventListener('focus', this.handleFocus);
        this.selectAnchor.removeEventListener('blur', this.handleBlur);
        this.selectAnchor.removeEventListener('keydown', this.handleKeydown);
        this.selectAnchor.removeEventListener(
            'click', this.handleClick as EventListener);

        this.menu.unlisten(
            menuSurfaceConstants.strings.CLOSED_EVENT, this.handleMenuClosed);
        this.menu.unlisten(
            menuSurfaceConstants.strings.OPENED_EVENT, this.handleMenuOpened);
        this.menu.unlisten(
            menuConstants.strings.SELECTED_EVENT, this.handleMenuItemAction);
        this.menu.destroy();

        if (this.ripple) {
            this.ripple.destroy();
        }
        if (this.outline) {
            this.outline.destroy();
        }
        if (this.leadingIcon) {
            this.leadingIcon.destroy();
        }
        if (this.helperText) {
            this.helperText.destroy();
        }

        super.destroy();
    }

    get value(): string[] {
        return this.foundation.getValue();
    }

    set value(value: string[]) {
        this.foundation.setValue(value);
    }

    setValue(value: string[], skipNotify = false) {
        this.foundation.setValue(value, skipNotify);
    }

    get selectedIndex(): number[] {
        return this.foundation.getSelectedIndex();
    }

    set selectedIndex(selectedIndex: number[]) {
        this.foundation.setSelectedIndex(selectedIndex, /* closeMenu */ true);
    }

    setSelectedIndex(selectedIndex: number[], skipNotify = false) {
        this.foundation.setSelectedIndex(
            selectedIndex, /* closeMenu */ true, skipNotify);
    }

    get disabled(): boolean {
        return this.foundation.getDisabled();
    }

    set disabled(disabled: boolean) {
        this.foundation.setDisabled(disabled);
    }

    set leadingIconAriaLabel(label: string) {
        this.foundation.setLeadingIconAriaLabel(label);
    }

    /**
     * Sets the text content of the leading icon.
     */
    set leadingIconContent(content: string) {
        this.foundation.setLeadingIconContent(content);
    }

    /**
     * Sets the text content of the helper text.
     */
    set helperTextContent(content: string) {
        this.foundation.setHelperTextContent(content);
    }

    /**
     * Enables or disables the default validation scheme where a required select
     * must be non-empty. Set to false for custom validation.
     * @param useDefaultValidation Set this to false to ignore default
     *     validation scheme.
     */
    set useDefaultValidation(useDefaultValidation: boolean) {
        this.foundation.setUseDefaultValidation(useDefaultValidation);
    }

    /**
     * Sets the current invalid state of the select.
     */
    set valid(isValid: boolean) {
        this.foundation.setValid(isValid);
    }

    /**
     * Checks if the select is in a valid state.
     */
    get valid(): boolean {
        return this.foundation.isValid();
    }

    /**
     * Sets the control to the required state.
     */
    set required(isRequired: boolean) {
        this.foundation.setRequired(isRequired);
    }

    /**
     * Returns whether the select is required.
     */
    get required(): boolean {
        return this.foundation.getRequired();
    }

    /**
     * Re-calculates if the notched outline should be notched and if the label
     * should float.
     */
    layout() {
        this.foundation.layout();
    }

    /**
     * Synchronizes the list of options with the state of the foundation. Call
     * this whenever menu options are dynamically updated.
     */
    layoutOptions() {
        this.foundation.layoutOptions();
        this.menu.layout();
        // Update cached menuItemValues for adapter.
        this.menuItemValues =
            this.menu.items.map((el) => el.getAttribute(strings.VALUE_ATTR) || '');
    }

    override getDefaultFoundation() {
        // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
        // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
        const adapter: MDCMultiSelectAdapter = {
            ...this.getMultiSelectAdapterMethods(),
            ...this.getCommonAdapterMethods(),
            ...this.getOutlineAdapterMethods(),
            ...this.getLabelAdapterMethods(),
        };
        return new MDCMultiSelectFoundation(adapter, this.getFoundationMap());
    }

    /**
     * Handles setup for the menu.
     */
    private menuSetup(menuFactory: MDCMenuFactory) {
        this.menuElement = this.root.querySelector(strings.MENU_SELECTOR)!;
        this.menu = menuFactory(this.menuElement);
        this.menu.hasTypeahead = true;
        this.menu.singleSelection = true;
        this.menuItemValues =
            this.menu.items.map((el) => el.getAttribute(strings.VALUE_ATTR) || '');
    }

    private createRipple(): MDCRipple {
        // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
        // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
        // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
        const adapter: MDCRippleAdapter = {
            ...MDCRipple.createAdapter({ root: this.selectAnchor }),
            registerInteractionHandler: (evtType, handler) => {
                this.selectAnchor.addEventListener(evtType, handler);
            },
            deregisterInteractionHandler: (evtType, handler) => {
                this.selectAnchor.removeEventListener(evtType, handler);
            },
        };
        // tslint:enable:object-literal-sort-keys
        return new MDCRipple(this.selectAnchor, new MDCRippleFoundation(adapter));
    }

    private getMultiSelectAdapterMethods() {
        // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
        return {
            getMenuItemAttr: (menuItem: Element, attr: string) =>
                menuItem.getAttribute(attr),
            setSelectedText: (text: string) => {
                this.selectedText.textContent = text;
            },
            isSelectAnchorFocused: () => document.activeElement === this.selectAnchor,
            getSelectAnchorAttr: (attr: string) =>
                this.selectAnchor.getAttribute(attr),
            setSelectAnchorAttr: (attr: string, value: string) => {
                this.selectAnchor.setAttribute(attr, value);
            },
            removeSelectAnchorAttr: (attr: string) => {
                this.selectAnchor.removeAttribute(attr);
            },
            addMenuClass: (className: string) => {
                this.menuElement.classList.add(className);
            },
            removeMenuClass: (className: string) => {
                this.menuElement.classList.remove(className);
            },
            openMenu: () => {
                this.menu.open = true;
            },
            closeMenu: () => {
                this.menu.open = false;
            },
            getAnchorElement: () =>
                this.root.querySelector(strings.SELECT_ANCHOR_SELECTOR)!,
            setMenuAnchorElement: (anchorEl: HTMLElement) => {
                this.menu.setAnchorElement(anchorEl);
            },
            setMenuAnchorCorner: (anchorCorner: menuSurfaceConstants.Corner) => {
                this.menu.setAnchorCorner(anchorCorner);
            },
            setMenuWrapFocus: (wrapFocus: boolean) => {
                this.menu.wrapFocus = wrapFocus;
            },
            getSelectedIndex: () => {
                const index = this.menu.selectedIndex;
                return index instanceof Array ? index : [index];
            },
            setSelectedIndex: (index: number[]) => {
                this.menu.selectedIndex = index;
            },
            focusMenuItemAtIndex: (index: number) => {
                (this.menu.items[index] as HTMLElement).focus();
            },
            getMenuItemCount: () => this.menu.items.length,
            // Cache menu item values. layoutOptions() updates this cache.
            getMenuItemValues: () => this.menuItemValues,
            getMenuItemTextAtIndex: (index: number) =>
                this.menu.getPrimaryTextAtIndex(index),
            isTypeaheadInProgress: () => this.menu.typeaheadInProgress,
            typeaheadMatchItem: (nextChar: string, startingIndex: number) =>
                this.menu.typeaheadMatchItem(nextChar, startingIndex),
        };
        // tslint:enable:object-literal-sort-keys
    }

    private getCommonAdapterMethods() {
        // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
        return {
            addClass: (className: string) => {
                this.root.classList.add(className);
            },
            removeClass: (className: string) => {
                this.root.classList.remove(className);
            },
            hasClass: (className: string) => this.root.classList.contains(className),
            setRippleCenter: (normalizedX: number) => {
                this.lineRipple && this.lineRipple.setRippleCenter(normalizedX)
            },
            activateBottomLine: () => {
                this.lineRipple && this.lineRipple.activate();
            },
            deactivateBottomLine: () => {
                this.lineRipple && this.lineRipple.deactivate();
            },
            notifyChange: (value: string[]) => {
                const index = this.selectedIndex;
                this.emit<MDCMultiSelectEventDetail>(
                    strings.CHANGE_EVENT, { value, index }, true /* shouldBubble  */);
            },
        };
        // tslint:enable:object-literal-sort-keys
    }

    private getOutlineAdapterMethods() {
        // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
        return {
            hasOutline: () => Boolean(this.outline),
            notchOutline: (labelWidth: number) => {
                this.outline && this.outline.notch(labelWidth);
            },
            closeOutline: () => {
                this.outline && this.outline.closeNotch();
            },
        };
        // tslint:enable:object-literal-sort-keys
    }

    private getLabelAdapterMethods() {
        // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
        return {
            hasLabel: () => !!this.label,
            floatLabel: (shouldFloat: boolean) => {
                this.label && this.label.float(shouldFloat);
            },
            getLabelWidth: () => this.label ? this.label.getWidth() : 0,
            setLabelRequired: (isRequired: boolean) => {
                this.label && this.label.setRequired(isRequired);
            },
        };
        // tslint:enable:object-literal-sort-keys
    }

    /**
     * Calculates where the line ripple should start based on the x coordinate within the component.
     */
    private getNormalizedXCoordinate(evt: MouseEvent | TouchEvent): number {
        const targetClientRect = (evt.target as Element).getBoundingClientRect();
        const xCoordinate =
            this.isTouchEvent(evt) ? evt.touches[0].clientX : evt.clientX;
        return xCoordinate - targetClientRect.left;
    }

    private isTouchEvent(evt: MouseEvent | TouchEvent): evt is TouchEvent {
        return Boolean((evt as TouchEvent).touches);
    }

    /**
     * Returns a map of all subcomponents to subfoundations.
     */
    private getFoundationMap(): Partial<MDCSelectFoundationMap> {
        return {
            helperText: this.helperText ? this.helperText.foundationForSelect :
                undefined,
            leadingIcon: this.leadingIcon ? this.leadingIcon.foundationForSelect :
                undefined,
        };
    }
}
