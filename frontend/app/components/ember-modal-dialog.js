import ModalDialog from 'ember-modal-dialog/components/modal-dialog';

/** The metaeditor-modal in components/panel/manage-dataset uses
 * ember-modal-dialog, which defines modal-dialog; pretzel also defines
 * components/modal-dialog which is used in components/new-datasource-modal.
 *
 * To resolve the ambiguous name 'modal-dialog'; this component, named
 * ember-modal-dialog, wraps ember-modal-dialog/components/modal-dialog,
 * so that manage-dataset can refer to ember-modal-dialog unambiguously.
 *
 * And at some point we can look at the 2 dialogs side by side and decide which
 * to use (solely).
 * If switching to use components/modal-dialog, there are 2 changes required :
 * .modal-backdrop covers the dialog if it has a position:relative *parent, as
 * manage-dataset does because of .col-xs-12 of its parent manage-base, which can
 * be solved by moving the modal to <body>; and .modal('show') is required
 * e.g. run.next( () => Ember.$('div.col-xs-12 > div > div.ember-view >
 * div.modal').appendTo("body").modal('show'); )
 * Update : .col-xs-12 is replaced with .panel-section, so the above issue with
 * position:relative should not apply.
 */
export default ModalDialog.extend({});
