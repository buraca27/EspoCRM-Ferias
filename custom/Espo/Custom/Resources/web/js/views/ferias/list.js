define('custom:views/ferias/list', ['views/list'], function (Dep) {

    return Dep.extend({

        template: 'custom:views/ferias/list',

        setup: function () {
            Dep.prototype.setup.call(this);
        },

        afterRender: function () {
            Dep.prototype.afterRender.call(this);

            // Adicionar classe CSS customizada
            this.$el.addClass('ferias-custom-list');

            // Melhorar o styling da tabela
            this.$el.find('table').addClass('table table-hover table-striped');
        }
    });
});
