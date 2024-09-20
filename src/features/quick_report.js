import { filterPostElements, getTimelineItemWrapper } from '../utils/interface.js';
import { registerMeatballItem, unregisterMeatballItem } from '../utils/meatballs.js';
import { hideModal } from '../utils/modals.js';
import { timelineObject } from '../utils/react_props.js';
import { onNewPosts, pageModifications } from '../utils/mutations.js';

const meatballButtonId = 'quickreport';
const meatballButtonLabel = 'Report bot/spam';
const hiddenAttribute = 'data-quickreport-hidden';
const storageKey = 'quickreport.blockedPostRootIDs';

let blockedPostRootIDs = [];

const postRequest = (resource, body, tumblrFormKey) => {
  return fetch(resource, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-tumblr-form-key': tumblrFormKey
    },
    body
  }).then(async response => {
    if (response.ok) {
      console.log('Post reported !');
      return response.json();
    } else {
      return Promise.reject(await response.json());
    }
  }
  ).catch(e => {
    console.log(e);
    e?.error?.contains('403') && openReportPage('Form key outdated !');
    throw e;
  });
};

const processPosts = postElements =>
  filterPostElements(postElements, { includeFiltered: true }).forEach(async postElement => {
    const postID = postElement.dataset.id;
    const { rebloggedRootId } = await timelineObject(postElement);

    const rootID = rebloggedRootId || postID;

    if (blockedPostRootIDs.includes(rootID)) {
      getTimelineItemWrapper(postElement).setAttribute(hiddenAttribute, '');
    } else {
      getTimelineItemWrapper(postElement).removeAttribute(hiddenAttribute);
    }
  });

const onButtonClicked = ({ currentTarget }) => {
  const { id, rebloggedRootId, blogName, rebloggedRootName } = currentTarget.__timelineObjectData;
  const rootID = rebloggedRootId || id;
  const blog = rebloggedRootName || blogName;
  const reportAndHide = async () => {
    sendReport(rootID, blog).then(() =>
      blockPost(rootID)
    );
  };
  reportAndHide();
};

const openReportPage = (errormsg) => {
  if (confirm(`${errormsg}\nVisit report page to refresh it`)) {
    window.open('https://www.tumblr.com/abuse/start');
  }
};

const blockPost = async rootID => {
  hideModal();
  const { [storageKey]: blockedPostRootIDs = [] } = await browser.storage.local.get(storageKey);
  blockedPostRootIDs.push(rootID);
  browser.storage.local.set({ [storageKey]: blockedPostRootIDs });
};

const sendReport = async function (postId, blogName) {
  const requestBody = {
    context: '', // stays empty
    source: '', // stays empty
    flag: 'spam',
    post_id: postId,
    tumblelog_name: blogName
  };

  const tumblrFormKey = window.localStorage.getItem('xkit.tumblr_form_key');
  if (!tumblrFormKey || tumblrFormKey === 'undefined') {
    openReportPage('No form key available !');
    throw new Error('No form key available !');
  }

  return postRequest('https://www.tumblr.com/svc/flag', $.param(requestBody), tumblrFormKey);
};

export const onStorageChanged = async function (changes, areaName) {
  if (Object.keys(changes).includes(storageKey)) {
    ({ newValue: blockedPostRootIDs = [] } = changes[storageKey]);
    pageModifications.trigger(processPosts);
  }
};

export const main = async function () {
  ({ [storageKey]: blockedPostRootIDs = [] } = await browser.storage.local.get(storageKey));

  registerMeatballItem({ id: meatballButtonId, label: meatballButtonLabel, onclick: onButtonClicked });

  onNewPosts.addListener(processPosts);
};

export const clean = async function () {
  unregisterMeatballItem(meatballButtonId);
  onNewPosts.removeListener(processPosts);

  $(`[${hiddenAttribute}]`).removeAttr(hiddenAttribute);
};

export const stylesheet = true;
