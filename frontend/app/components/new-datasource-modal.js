// import ModalDialog from './modal-dialog'
const { inject: { service }, Component } = Ember;

export default Ember.Component.extend({
    apiServers: service(),

    didInsertElement: Ember.on('didInsertElement', function() {
        let confirmButton = this.$('button[name=confirm]');
        this.$('input[name=password]').keyup(function(event) {
            if (event.keyCode == 13) {
                confirmButton.click();
            }
        });
    }),

    actions: {
        onConfirm() {
            console.log('onConfirm');
            let host = this.$('input[name=host]').val();
            let user = this.$('input[name=user]').val();
            let password = this.$('input[name=password]').val();
            this.get('apiServers').ServerLogin(host, user, password);
        }
    }
});
