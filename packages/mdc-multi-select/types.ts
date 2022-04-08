export interface MDCMultiSelectEventDetail {
    value: string[];
    index: number[];
}
export interface MDCMultiSelectEvent extends Event {
    readonly detail: MDCMultiSelectEventDetail;
}
