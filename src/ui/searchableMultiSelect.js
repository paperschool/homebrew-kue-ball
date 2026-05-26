import { checkbox, Separator } from "@inquirer/prompts";

export async function searchableMultiSelect({
    message,
    items,
    pageSize,
    validate,
}) {
    const checkedItems = items.filter((item) => item.checked);
    const uncheckedItems = items.filter((item) => !item.checked);

    const choices = [];

    for (const item of checkedItems) {
        choices.push({ name: item.name, value: item.value, checked: true });
    }

    if (checkedItems.length > 0 && uncheckedItems.length > 0) {
        choices.push(new Separator());
    }

    for (const item of uncheckedItems) {
        choices.push({ name: item.name, value: item.value, checked: false });
    }

    const defaultValidate = (v) => v.length > 0 || "Select at least one.";

    return checkbox({
        message,
        choices,
        pageSize: pageSize ?? 20,
        validate: validate ?? defaultValidate,
        searchable: true,
    });
}
