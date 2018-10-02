// import ModalDialog from './modal-dialog'

export default Ember.Component.extend({
    actions: {
        onConfirm() {
            console.log('onConfirm');
            let host = this.$('input[name=host]').val();
            let user = this.$('input[name=user]').val();
            let password = this.$('input[name=password]').val();
            console.log(host, user, password);
        }
    }
});
