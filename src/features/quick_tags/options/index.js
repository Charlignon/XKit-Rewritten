import { Sortable } from '../../../lib/sortable.esm.js';
import { dom } from '../../../utils/dom.js';

const bundleStorageKey = 'quick_tags.preferences.tagBundles';
const groupStorageKey = 'quick_tags.preferences.groups';

const bundlesList = document.getElementById('bundles');
const bundleTemplate = document.getElementById('bundle-template');

const groupList = document.getElementById('groups');
const groupTemplate = document.getElementById('group-template');
const groupSelect = document.getElementById('new-bundle-group');

const defaultOption = dom('option', { value: '', selected: true }, null, '-- Pick a tag group (optional) --');

const saveNewGroup = async event => {
  event.preventDefault();
  const { currentTarget } = event;

  if (!currentTarget.reportValidity()) { return; }
  const { name } = currentTarget.elements;

  const { [groupStorageKey]: groups = [] } = await browser.storage.local.get(groupStorageKey);
  groups.push(name.value);
  await browser.storage.local.set({ [groupStorageKey]: groups });

  currentTarget.reset();
};

const saveNewBundle = async event => {
  event.preventDefault();
  const { currentTarget } = event;

  if (!currentTarget.reportValidity()) { return; }
  const { title, tags, group } = currentTarget.elements;

  const tagBundle = {
    title: title.value,
    tags: tags.value,
    group: !group.value ? undefined : group.value
  };

  const { [bundleStorageKey]: tagBundles = [] } = await browser.storage.local.get(bundleStorageKey);
  tagBundles.push(tagBundle);
  await browser.storage.local.set({ [bundleStorageKey]: tagBundles });

  currentTarget.reset();
};

Sortable.create(bundlesList, {
  dataIdAttr: 'id',
  handle: '.drag-handle',
  store: {
    set: async sortable => {
      const { [bundleStorageKey]: tagBundles = [] } = await browser.storage.local.get(bundleStorageKey);

      const order = sortable.toArray().map(Number);
      const newTagBundles = order.map(i => tagBundles[i]);

      browser.storage.local.set({ [bundleStorageKey]: newTagBundles });
    }
  }
});

const editTagBundle = async ({ currentTarget }) => {
  const { parentNode: { parentNode } } = currentTarget;
  const inputs = [...parentNode.querySelectorAll('input')];

  const viewWrapper = parentNode.querySelector('.bundle-view');
  const editWrapper = parentNode.querySelector('.bundle-edit');

  const groupInput = editWrapper.querySelector('.group');

  if (currentTarget.title === 'Edit tag bundle') {
    currentTarget.title = 'Save tag bundle';
    currentTarget.firstElementChild.className = 'ri-save-3-fill';
    editWrapper.classList.remove('hidden');
    viewWrapper.classList.add('hidden');

    const select = groupSelect.cloneNode(true);
    select.value = groupInput.value;
    select.addEventListener('change', e => {
      groupInput.value = e.currentTarget.value;
    });
    inputs[0].parentNode.appendChild(select);
  } else {
    if (inputs.some(input => input.reportValidity() === false)) { return; }
    currentTarget.title = 'Edit tag bundle';
    currentTarget.firstElementChild.className = 'ri-pencil-line';

    const { [bundleStorageKey]: tagBundles = [] } = await browser.storage.local.get(bundleStorageKey);
    const index = parseInt(parentNode.id);
    const tagBundle = tagBundles[index];

    editWrapper.classList.add('hidden');
    viewWrapper.classList.remove('hidden');

    for (const input of inputs) {
      tagBundle[input.className] = !input.value ? undefined : input.value;
    }
    editWrapper.querySelector('select').remove();

    browser.storage.local.set({ [bundleStorageKey]: tagBundles });
  }
};

const deleteBundle = async ({ currentTarget }) => {
  const { parentNode: { parentNode } } = currentTarget;

  const { [bundleStorageKey]: tagBundles = [] } = await browser.storage.local.get(bundleStorageKey);
  const index = parseInt(parentNode.id);
  tagBundles.splice(index, 1);
  browser.storage.local.set({ [bundleStorageKey]: tagBundles });
};

const deleteGroup = async e => {
  const { currentTarget } = e;
  e.preventDefault();
  const { parentNode: { parentNode } } = currentTarget;
  const groupToDelete = parentNode.id;

  const { [groupStorageKey]: groups = [] } = await browser.storage.local.get(groupStorageKey);
  const index = groups.findIndex(group => group === groupToDelete);
  groups.splice(index, 1);

  const { [bundleStorageKey]: tagBundles = [] } = await browser.storage.local.get(bundleStorageKey);
  tagBundles.forEach(bundle => {
    if (bundle.group === groupToDelete) { bundle.group = undefined; }
  });

  await browser.storage.local.set({ [groupStorageKey]: groups, [bundleStorageKey]: tagBundles });
};

const renderBundles = async function () {
  const { [bundleStorageKey]: tagBundles = [] } = await browser.storage.local.get(bundleStorageKey);

  bundlesList.append(...tagBundles.map(({ title, tags, group }, index) => {
    const bundleTemplateClone = bundleTemplate.content.cloneNode(true);

    bundleTemplateClone.querySelector('.bundle').id = index;

    bundleTemplateClone.querySelector('span.title').textContent = title;
    bundleTemplateClone.querySelector('span.tags').textContent = tags;
    bundleTemplateClone.querySelector('span.group').textContent = group;
    if (!group) {
      bundleTemplateClone.querySelector('span.group').classList.add('hidden');
    }

    bundleTemplateClone.querySelector('input.title').value = title;
    bundleTemplateClone.querySelector('input.tags').value = tags;
    bundleTemplateClone.querySelector('input.group').value = group;

    bundleTemplateClone.querySelector('.edit').addEventListener('click', editTagBundle);
    bundleTemplateClone.querySelector('.delete').addEventListener('click', deleteBundle);

    return bundleTemplateClone;
  }));

  renderGroupSelect();
};

const renderGroupSelect = async () => {
  const { [groupStorageKey]: groups = [] } = await browser.storage.local.get(groupStorageKey);
  const options = dom('span');
  options.replaceChildren(defaultOption, ...groups.map(group => dom('option', { value: group }, null, group)));

  groupSelect.replaceChildren(...options.cloneNode(true).children);
};

const renderGroupList = async () => {
  const { [groupStorageKey]: groups = [] } = await browser.storage.local.get(groupStorageKey);
  groupList.replaceChildren(...groups.map(group => {
    const groupTemplateClone = groupTemplate.content.cloneNode(true);

    groupTemplateClone.querySelector('.group').id = group;
    groupTemplateClone.querySelector('.name').textContent = group;
    groupTemplateClone.querySelector('.delete').addEventListener('click', deleteGroup);

    return groupTemplateClone;
  }));
};

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && Object.keys(changes).includes(bundleStorageKey)) {
    bundlesList.textContent = '';
    renderBundles();
  }
  if (areaName === 'local' && Object.keys(changes).includes(groupStorageKey)) {
    renderGroupList();
    renderGroupSelect();
  }
});

document.getElementById('new-bundle').addEventListener('submit', saveNewBundle);
document.getElementById('new-group').addEventListener('submit', saveNewGroup);

await renderBundles();
await renderGroupList();
await renderGroupSelect();
