define('custom:views/fields/qr-expense/detail', ['views/fields/base'], function (Dep) {

    return Dep.extend({

        templateContent: `
            <div class="qr-expense-detail">
                {{#if attachmentName}}
                    <span class="fas fa-paperclip" style="color:#4a90d9;margin-right:6px;"></span>
                    <a href="{{attachmentUrl}}" target="_blank">{{attachmentName}}</a>
                {{else}}
                    <span style="color:#999;">Sem documento anexo</span>
                {{/if}}
            </div>
        `,

        data: function () {
            var attachId = this.model.get('documentocontabId');
            var attachName = this.model.get('documentocontabName');

            return {
                attachmentName: attachName || null,
                attachmentUrl: attachId
                    ? (window.location.origin + '/?entryPoint=download&id=' + attachId)
                    : null
            };
        }
    });
});
