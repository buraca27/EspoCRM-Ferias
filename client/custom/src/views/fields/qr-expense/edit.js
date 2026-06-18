define('custom:views/fields/qr-expense/edit', ['views/fields/base'], function (Dep) {

    var BASE_PATH = (function () {
        return window.location.origin +
               window.location.pathname.split('#')[0].replace(/\/+$/, '');
    }());
    var QR_SCANNER_URL = BASE_PATH + '/client/custom/lib/qr-scanner.umd.min.js';
    var QR_WORKER_URL  = BASE_PATH + '/client/custom/lib/qr-scanner-worker.min.js';
    var JSPDF_URL      = BASE_PATH + '/client/custom/lib/jspdf.umd.min.js';

    return Dep.extend({

        templateContent: '<div class="qr-expense-root"></div>',

        setup: function () {
            Dep.prototype.setup.call(this);
        },

        afterRender: function () {
            Dep.prototype.afterRender.call(this);
            if (this.mode === 'detail' || this.mode === 'list') {
                this._buildDetailUI();
            } else {
                this._buildUI();
            }
        },

        /* ── Detail mode ───────────────────────────────────── */

        _buildDetailUI: function () {
            var attachId   = this.model.get('documentocontabId')   || '';
            var attachName = this.model.get('documentocontabName') || '';
            var html = attachId
                ? '<span class="fas fa-paperclip" style="color:#4a90d9;margin-right:5px;"></span>' +
                  '<a href="' + BASE_PATH + '/?entryPoint=download&id=' + attachId +
                  '" target="_blank">' + attachName + '</a>'
                : '<span style="color:#aaa;">Sem documento</span>';
            this.$el.find('.qr-expense-root').html(html);
        },

        /* ── Edit mode ─────────────────────────────────────── */

        _buildUI: function () {
            var attachId   = this.model.get('documentocontabId')   || '';
            var attachName = this.model.get('documentocontabName') || '';

            var attachHtml = attachId
                ? '<div class="qr-attach" style="margin-top:6px;font-size:13px;color:#555;">' +
                  '<span class="fas fa-paperclip" style="color:#4a90d9;margin-right:5px;"></span>' +
                  '<a href="' + BASE_PATH + '/?entryPoint=download&id=' + attachId +
                  '" target="_blank">' + attachName + '</a></div>'
                : '<div class="qr-attach" style="display:none;margin-top:6px;font-size:13px;color:#555;"></div>';

            /* File input — no capture attr so browser shows camera+gallery sheet */
            var html =
                '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px;">' +
                    '<label class="btn btn-default qr-btn-scan" ' +
                    'style="display:flex;align-items:center;gap:6px;padding:7px 14px;cursor:pointer;margin:0;">' +
                        '<span class="fas fa-camera" style="font-size:15px;"></span>' +
                        '<span class="qr-btn-label">Foto da Fatura</span>' +
                        '<input type="file" accept="image/*" capture="environment" class="qr-file-input" ' +
                        'style="display:none;position:absolute;width:0;height:0;">' +
                    '</label>' +
                    '<span class="qr-status" style="font-size:13px;color:#888;"></span>' +
                '</div>' +
                attachHtml +
                '<div class="qr-error" style="display:none;color:#e74c3c;font-size:13px;margin-top:5px;"></div>' +
                /* Preview thumbnail */
                '<div class="qr-preview" style="display:none;margin-top:8px;">' +
                    '<img class="qr-preview-img" style="max-width:120px;max-height:160px;' +
                    'border-radius:6px;border:1px solid #ddd;object-fit:cover;">' +
                '</div>';

            this.$el.find('.qr-expense-root').html(html);

            this.$el.find('.qr-file-input').on('change', function (e) {
                var file = e.target.files && e.target.files[0];
                if (file) { this._processImage(file); }
                /* Reset so same file can be re-selected */
                e.target.value = '';
            }.bind(this));
        },

        /* ── Main processing pipeline ──────────────────────── */

        _processImage: function (file) {
            var self = this;
            this._clearError();
            this._setStatus('A ler QR code...');
            this._setBtnState('loading');

            var objectUrl = URL.createObjectURL(file);
            this.$el.find('.qr-preview-img').attr('src', objectUrl);
            this.$el.find('.qr-preview').show();

            this._loadScript(QR_SCANNER_URL, 'QrScanner', function () {
                window.QrScanner.WORKER_PATH = QR_WORKER_URL;

                /* Load image first to get full dimensions,
                   then scan the ENTIRE image (not just center crop) */
                var img = new Image();
                img.onload = function () {
                    var w = img.naturalWidth;
                    var h = img.naturalHeight;

                    window.QrScanner.scanImage(img, {
                        returnDetailedScanResult: true,
                        scanRegion: { x: 0, y: 0, width: w, height: h }
                    })
                    .then(function (result) {
                        var raw = (result && result.data) ? result.data : String(result);
                        console.log('[QR] raw:', raw.substring(0, 200));
                        var parsed = self._parseQrAT(raw);
                        if (parsed) {
                            self._applyParsed(parsed);
                            self._setStatus('QR AT lido — a converter para PDF...');
                        } else {
                            self._setStatus('QR nao e formato AT — a converter para PDF...');
                        }
                        self._imgToPdfAndUpload(img, objectUrl, !!parsed);
                    })
                    .catch(function () {
                        self._setStatus('Sem QR — a converter para PDF...');
                        self._imgToPdfAndUpload(img, objectUrl, false);
                    });
                };
                img.onerror = function () {
                    URL.revokeObjectURL(objectUrl);
                    self._showError('Erro ao carregar imagem.');
                    self._setBtnState('idle');
                };
                img.src = objectUrl;
            });
        },

        /* ── Image → A4 PDF → upload ────────────────────────── */

        _imgToPdfAndUpload: function (img, objectUrl, qrSuccess) {
            var self = this;
            this._loadScript(JSPDF_URL, 'jspdf', function () {
                var canvas = document.createElement('canvas');
                canvas.width  = img.naturalWidth;
                canvas.height = img.naturalHeight;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(objectUrl);

                /* Convert to greyscale in-place */
                var id = ctx.getImageData(0, 0, canvas.width, canvas.height);
                var d  = id.data;
                for (var p = 0; p < d.length; p += 4) {
                    var g = Math.round(0.299 * d[p] + 0.587 * d[p+1] + 0.114 * d[p+2]);
                    d[p] = d[p+1] = d[p+2] = g;
                }
                ctx.putImageData(id, 0, 0);

                var a4W = 210, a4H = 297, margin = 8;
                var maxW = a4W - 2 * margin, maxH = a4H - 2 * margin;
                var ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
                var fitW  = canvas.width  * ratio;
                var fitH  = canvas.height * ratio;

                var JsPDF   = (window.jspdf && window.jspdf.jsPDF) || window.jspdf;
                var imgData = canvas.toDataURL('image/jpeg', 0.88);
                var pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                pdf.addImage(imgData, 'JPEG', (a4W - fitW) / 2, (a4H - fitH) / 2, fitW, fitH);

                self._setStatus('A enviar PDF...');
                self._uploadBlob(pdf.output('blob'), qrSuccess);
            });
        },

        /* ── QR AT parser ──────────────────────────────────── */

        _parseQrAT: function (raw) {
            if (!raw) { return null; }
            raw = raw.replace(/[\r\n]/g, '');
            if (raw.indexOf('A:') === -1 || raw.indexOf('O:') === -1) { return null; }

            var fields = {};
            raw.split('*').forEach(function (pair) {
                var idx = pair.indexOf(':');
                if (idx > -1) { fields[pair.substring(0, idx)] = pair.substring(idx + 1); }
            });

            var nif   = fields['A'] || '';
            var total = parseFloat(fields['O'] || '0') || 0;

            /* Slide a window over consecutive I-fields (I2..I12).
               Collect ALL valid tax pairs (rate 1%-30%) — a single invoice
               can have multiple brackets (e.g. 13% + 23%). Sum all bases and
               IVAs; taxaiva = rate of the bracket with the largest base. */
            var iKeys        = ['I2','I3','I4','I5','I6','I7','I8','I9','I10','I11','I12'];
            var totalBase    = 0, totalIva = 0, dominantBase = 0, dominantRate = 0;
            var usedIdx      = {};

            for (var i = 0; i < iKeys.length - 1; i++) {
                if (usedIdx[i]) { continue; }
                var base = parseFloat(fields[iKeys[i]]   || '0');
                var iva  = parseFloat(fields[iKeys[i+1]] || '0');
                if (base <= 0 || iva <= 0) { continue; }
                var rate = iva / base;
                if (rate < 0.01 || rate > 0.30) { continue; }
                totalBase += base;
                totalIva  += iva;
                if (base > dominantBase) { dominantBase = base; dominantRate = rate; }
                usedIdx[i] = usedIdx[i + 1] = true;
                i++;
            }

            return {
                nif:      nif,
                subtotal: Math.round(totalBase * 100) / 100,
                iva:      Math.round(totalIva  * 100) / 100,
                taxaiva:  dominantBase > 0 ? Math.round(dominantRate * 100) : 0,
                total:    total
            };
        },

        _applyParsed: function (p) {
            this.model.set('nifdocumento', p.nif);
            this.model.set('subtotal',     p.subtotal);
            this.model.set('iva',          p.iva);
            this.model.set('taxaiva',      p.taxaiva);
            this.model.set('total',        p.total);
        },

        /* ── Upload ────────────────────────────────────────── */

        _uploadBlob: function (blob, qrSuccess) {
            var self     = this;
            var fileName = 'fatura-' + Date.now() + '.pdf';
            var reader   = new FileReader();
            reader.onload = function (e) {
                Espo.Ajax.postRequest('Attachment', {
                    name:       fileName,
                    type:       'application/pdf',
                    parentType: 'Contabdoc',
                    field:      'documentocontab',
                    role:       'Attachment',
                    file:       e.target.result
                }).then(function (resp) {
                    if (resp && resp.id) {
                        self.model.set('documentocontabId',   resp.id);
                        self.model.set('documentocontabName', resp.name || fileName);
                        self._updateAttachLine(resp.id, resp.name || fileName);
                    }
                    self._setBtnState(qrSuccess ? 'done' : 'idle');
                    self._setStatus(qrSuccess
                        ? 'QR AT lido e PDF guardado'
                        : 'PDF guardado — preenche os campos manualmente');
                }).catch(function (err) {
                    console.error('[QR] upload error', err);
                    self._setBtnState('idle');
                    self._setStatus('Erro ao enviar PDF');
                });
            };
            reader.readAsDataURL(blob);
        },

        _updateAttachLine: function (id, name) {
            this.$el.find('.qr-attach').html(
                '<span class="fas fa-paperclip" style="color:#4a90d9;margin-right:5px;"></span>' +
                '<a href="' + BASE_PATH + '/?entryPoint=download&id=' + id +
                '" target="_blank">' + name + '</a>'
            ).show();
        },

        /* ── UI helpers ────────────────────────────────────── */

        _setBtnState: function (state) {
            var $btn   = this.$el.find('.qr-btn-scan');
            var $label = this.$el.find('.qr-btn-label');
            var $icon  = $btn.find('.fas');
            if (state === 'idle') {
                $icon.attr('class', 'fas fa-camera').css('font-size', '15px');
                $label.text('Foto da Fatura');
                $btn.removeClass('btn-success').addClass('btn-default');
            } else if (state === 'loading') {
                $icon.attr('class', 'fas fa-spinner fa-spin');
                $label.text('A processar...');
                $btn.removeClass('btn-success').addClass('btn-default');
            } else if (state === 'done') {
                $icon.attr('class', 'fas fa-check');
                $label.text('QR lido');
                $btn.removeClass('btn-default').addClass('btn-success');
            }
        },

        _setStatus: function (msg) { this.$el.find('.qr-status').text(msg); },
        _showError:  function (msg) { this.$el.find('.qr-error').text(msg).show(); },
        _clearError: function ()    { this.$el.find('.qr-error').hide().text(''); },

        /* ── Script loader — suppress AMD so UMD assigns to window ─ */

        _loadScript: function (url, globalName, cb) {
            if (window[globalName]) { cb(); return; }
            var self = this;
            /* Temporarily hide AMD so the UMD build falls through to
               the window global assignment instead of calling define() */
            var amd = define.amd;
            define.amd = undefined;
            var script = document.createElement('script');
            script.src = url;
            script.onload = function () {
                define.amd = amd;
                cb();
            };
            script.onerror = function () {
                define.amd = amd;
                console.error('[QR] Failed to load:', url);
                self._showError('Erro ao carregar ' + globalName + '. URL: ' + url);
                self._setBtnState('idle');
            };
            document.head.appendChild(script);
        }
    });
});
