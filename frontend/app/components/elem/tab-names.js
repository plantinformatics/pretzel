import Component from '@glimmer/component';
import EmberObject, { computed, action, set as Ember_set, setProperties } from '@ember/object';
import { tracked } from '@glimmer/tracking';

import { text2EltId } from '../../utils/explorer-tabId';

//------------------------------------------------------------------------------

const dLog = console.debug;

const trace = 1;

//------------------------------------------------------------------------------

/**
 * @param idPrefix  e.g. 'tab-view-SampleFilter-'
 * @param names text name of tab, which may be the displayed text label and
 * contain spaces; it is mapped via tabName2Id() to the tabId which is used as
 * DOM element id.
 * @param setSelected action to call when user changes selected tab
 */
export default class ElemTabNamesComponent extends Component {

  /** based on manage-genotype : activeIdDatasets, activeDatasetId, tabName2IdDatasets(), selectDataset(), setSelectedDataset(), onChangeTab().
   * with activeIdDatasets -> activeId, activeDatasetId -> activeName,
   * selectDataset() -> selectTab(), setSelectedDataset() -> setSelected(),
   * tabName2IdDatasets() -> tabName2Id(),
   */
  /** activeIdDatasets, tabName2IdDatasets() are analogous to and based on 
   * manage-genotype : activeId, tabName2Id().
   */
  @tracked
  activeName = null;
  @tracked
  activeId = null;

  constructor() {
    super(...arguments);
    if (window.PretzelFrontend) {
      window.PretzelFrontend.tabNames = this;
    }
    // Initially active tab : @activeName or default to the first tab.
    this.setSelected(undefined, this.args.activeName || this.args.names[0]);
    if (trace) {
      dLog('tab-names', 'constructor', this.activeId);
    }
  }

  /** invoked from hbs via {{compute (action this.tabName2Id tabTypeName ) }}
   * @param tabName text displayed on the tab for user identification of the contents.
   * @return string suitable for naming a html tab, based on tabName.
   */
  @action
  tabName2Id(tabName) {
    let
    // text2EltId() maps space (and any other non-alphanumeric) to '-'
    id = this.args.idPrefix + text2EltId(tabName);
    if (trace) {
      dLog('tabName2Id', id, tabName);
    }
    return id;
  }
  tabId2Name(tabId) {
    const name = tabId.split(this.args.idPrefix)?.[1]?.replace('-', ' ');
    return name;
  }

  @computed
  get tabIds() {
    return this.args.names.map(name => this.tabName2Id(name));
  }

  //----------------------------------------------------------------------------

  /** Receive user tab selection changes, for controls dialog.
   * @param id  tab name
   */
  @action
  onChangeTab(tabId, previous) {
    const fnName = 'onChangeTab';

    // or this.setSelected(tabId, undefined); see comment in selectTabName()
    this.activeId = tabId;
    this.activeName = tabId.split(this.args.idPrefix)?.[1]?.replace('-', ' ');
    if (trace) {
      dLog(fnName, 'activeId', this.activeId, this.activeName, this, tabId, previous, arguments);
    }
  }


  /** Receive user tab selection change.
   * @param tabName
   */
  @action
  selectTabName(name, tab) {
    const fnName = 'selectTabName';
    if (trace) {
      dLog(fnName, this, name, tab, arguments);
    }

    const
    names = this.args.names,
    i = names.findIndex(tabName => tabName === name);
    if (i < 0) {
      if (trace) {
        dLog(fnName, i, name, names);
      }
    } else {
      if (trace) {
        dLog(fnName, i, names[i], name);
      }
      /** both onChangeTab() and selectTab() actions work, so could merge
       * i.e. do both this.setSelected() and this.args.setSelected() in one
       * place.
       */
      // this.setSelected(undefined, name);
      this.args.setSelected(name, i);
    }
  }
  /** Receive user tab selection change.
   * @param tabId
   */
  @action
  selectTabId(id) {
    const fnName = 'selectTabId';
    if (trace) {
      dLog(fnName, this, id, arguments);
    }

    const
    ids = this.tabIds,
    i = ids.findIndex(tabId => tabId === id);
    if (i < 0) {
      if (trace) {
        dLog(fnName, i, id, ids);
      }
    } else {
      if (trace) {
        dLog(fnName, i, ids[i], id);
      }
      // this.setSelected(id, undefined);
      this.args.setSelected(id, i);
    }
  }

  setSelected(id, name) {
    this.activeId = id || this.tabName2Id(name);
    this.activeName = name || this.tabId2Name(id);
  }



}

//------------------------------------------------------------------------------
