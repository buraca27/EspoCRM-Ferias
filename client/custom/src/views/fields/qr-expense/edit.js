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
                /* Pre-load libs so they're cached when the user takes a photo */
                this._loadScript(QR_SCANNER_URL, 'QrScanner', function () {
                    window.QrScanner.WORKER_PATH = QR_WORKER_URL;
                });
                this._loadScript(JSPDF_URL, 'jspdf', function () {});
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
            var self = this;
            var attachId   = this.model.get('documentocontabId')   || '';
            var attachName = this.model.get('documentocontabName') || '';

            var attachHtml = attachId
                ? '<div class="qr-attach" style="margin-top:6px;font-size:13px;color:#555;">' +
                  '<span class="fas fa-paperclip" style="color:#4a90d9;margin-right:5px;"></span>' +
                  '<a href="' + BASE_PATH + '/?entryPoint=download&id=' + attachId +
                  '" target="_blank">' + attachName + '</a></div>'
                : '<div class="qr-attach" style="display:none;margin-top:6px;font-size:13px;color:#555;"></div>';

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

                /* Duplicate warning (hidden) */
                '<div class="qr-dup-warning" style="display:none;margin-top:10px;background:#fff8e1;' +
                'border:1px solid #ffe082;border-radius:6px;padding:10px 12px;">' +
                    '<div style="font-weight:600;color:#f57f17;margin-bottom:6px;font-size:13px;">' +
                        '<span class="fas fa-exclamation-triangle" style="margin-right:5px;"></span>' +
                        'Possível duplicado encontrado' +
                    '</div>' +
                    '<div class="qr-dup-list" style="font-size:12px;color:#555;margin-bottom:10px;"></div>' +
                    '<div style="display:flex;gap:8px;">' +
                        '<button type="button" class="btn btn-xs btn-warning qr-btn-dup-continue">Continuar mesmo assim</button>' +
                        '<button type="button" class="btn btn-xs btn-default qr-btn-dup-cancel">Cancelar</button>' +
                    '</div>' +
                '</div>' +

                attachHtml +
                '<div class="qr-error" style="display:none;color:#e74c3c;font-size:13px;margin-top:5px;"></div>' +
                '<div class="qr-preview" style="display:none;margin-top:8px;">' +
                    '<img class="qr-preview-img" style="max-width:120px;max-height:160px;' +
                    'border-radius:6px;border:1px solid #ddd;object-fit:cover;">' +
                '</div>';

            this.$el.find('.qr-expense-root').html(html);

            this.$el.find('.qr-file-input').on('change', function (e) {
                var file = e.target.files && e.target.files[0];
                e.target.value = '';
                if (file) { self._processImage(file); }
            });
        },

        /* ── Main processing pipeline ──────────────────────── */

        _processImage: function (file) {
            var self = this;
            this._clearError();
            this._hideDupWarning();
            this._setStatus('A ler QR code...');
            this._setBtnState('loading');
            this._setSaveDisabled(true);

            var objectUrl = URL.createObjectURL(file);
            this.$el.find('.qr-preview-img').attr('src', objectUrl);
            this.$el.find('.qr-preview').show();

            this._loadScript(QR_SCANNER_URL, 'QrScanner', function () {
                window.QrScanner.WORKER_PATH = QR_WORKER_URL;

                var img = new Image();
                img.onload = function () {
                    var w = img.naturalWidth;
                    var h = img.naturalHeight;

                    /* Downscale to 1200px max for speed */
                    var MAX_QR  = 1200;
                    var qrScale = Math.min(1, MAX_QR / Math.max(w, h));
                    var qrW     = Math.round(w * qrScale);
                    var qrH     = Math.round(h * qrScale);
                    var qrFull  = document.createElement('canvas');
                    qrFull.width = qrW; qrFull.height = qrH;
                    qrFull.getContext('2d').drawImage(img, 0, 0, qrW, qrH);

                    /* Scan left and right halves in parallel to detect
                       whether the photo contains more than one receipt */
                    var halfW = Math.round(qrW / 2);
                    function makeCrop(sx, sw) {
                        var c = document.createElement('canvas');
                        c.width = sw; c.height = qrH;
                        c.getContext('2d').drawImage(qrFull, sx, 0, sw, qrH, 0, 0, sw, qrH);
                        return c;
                    }

                    function doScan(canvas) {
                        return window.QrScanner.scanImage(canvas, {
                            returnDetailedScanResult: true,
                            scanRegion: { x: 0, y: 0, width: canvas.width, height: canvas.height }
                        }).then(function (r) {
                            return (r && r.data) ? r.data : String(r);
                        }).catch(function () { return null; });
                    }

                    Promise.all([
                        doScan(makeCrop(0, halfW)),
                        doScan(makeCrop(halfW, qrW - halfW))
                    ]).then(function (raws) {
                        var rawL = raws[0], rawR = raws[1];

                        /* Two distinct valid AT QR codes → two receipts in one photo */
                        var parsedL = rawL ? self._parseQrAT(rawL) : null;
                        var parsedR = rawR ? self._parseQrAT(rawR) : null;
                        if (parsedL && parsedR && rawL !== rawR) {
                            URL.revokeObjectURL(objectUrl);
                            self._setSaveDisabled(false);
                            self._setBtnState('idle');
                            self._showError(
                                '2 faturas detetadas na imagem. ' +
                                'Por favor fotografe cada fatura separadamente.'
                            );
                            return;
                        }

                        /* Single result: use whichever half found it */
                        var raw    = rawL || rawR;
                        var parsed = raw ? self._parseQrAT(raw) : null;

                        if (parsed) {
                            self._setStatus('QR AT lido — a verificar duplicados...');
                            self._checkDuplicates(parsed, img, objectUrl);
                        } else {
                            self._setStatus('QR não é formato AT — a converter para PDF...');
                            self._imgToPdfAndUpload(img, objectUrl, false);
                        }
                    });
                };
                img.onerror = function () {
                    URL.revokeObjectURL(objectUrl);
                    self._showError('Erro ao carregar imagem.');
                    self._setSaveDisabled(false);
                    self._setBtnState('idle');
                };
                img.src = objectUrl;
            });
        },

        /* ── Duplicate detection ───────────────────────────── */

        _checkDuplicates: function (parsed, img, objectUrl) {
            var self = this;
            var where = [
                { type: 'equals', attribute: 'nifdocumento', value: parsed.nif },
                { type: 'equals', attribute: 'total',        value: parsed.total }
            ];
            if (this.model.id) {
                where.push({ type: 'notEquals', attribute: 'id', value: this.model.id });
            }

            Espo.Ajax.getRequest('Contabdoc', { where: where, maxSize: 5 })
            .then(function (resp) {
                var list = (resp && resp.list) ? resp.list : [];
                if (list.length > 0) {
                    self._setStatus('');
                    self._showDupWarning(list, parsed, img, objectUrl);
                } else {
                    self._applyParsed(parsed);
                    self._setStatus('QR AT lido — a converter para PDF...');
                    self._imgToPdfAndUpload(img, objectUrl, true);
                }
            })
            .catch(function () {
                self._applyParsed(parsed);
                self._setStatus('QR AT lido — a converter para PDF...');
                self._imgToPdfAndUpload(img, objectUrl, true);
            });
        },

        _showDupWarning: function (list, parsed, img, objectUrl) {
            var self = this;
            var rows = list.map(function (r) {
                return '<div style="padding:2px 0;">• <strong>' + (r.name || r.id) + '</strong>' +
                       (r.status ? ' — ' + r.status : '') +
                       (r.dataemissao ? ' — ' + r.dataemissao : '') + '</div>';
            }).join('');

            this.$el.find('.qr-dup-list').html(rows);
            this.$el.find('.qr-dup-warning').show();

            this.$el.find('.qr-btn-dup-continue').off('click').on('click', function () {
                self._hideDupWarning();
                self._applyParsed(parsed);
                self._setStatus('QR AT lido — a converter para PDF...');
                self._imgToPdfAndUpload(img, objectUrl, true);
            });
            this.$el.find('.qr-btn-dup-cancel').off('click').on('click', function () {
                self._hideDupWarning();
                URL.revokeObjectURL(objectUrl);
                self._setSaveDisabled(false);
                self._setBtnState('idle');
                self._setStatus('Cancelado.');
            });
        },

        _hideDupWarning: function () {
            this.$el.find('.qr-dup-warning').hide();
        },

        /* ── Image → A4 PDF → upload ────────────────────────── */

        _imgToPdfAndUpload: function (img, objectUrl, qrSuccess) {
            var self = this;
            this._loadScript(JSPDF_URL, 'jspdf', function () {
                /* Cap at 2000px — enough for A4 300dpi, avoids slow pixel loops on 12MP shots */
                var MAX_PDF  = 2000;
                var w        = img.naturalWidth, h = img.naturalHeight;
                var pdfScale = Math.min(1, MAX_PDF / Math.max(w, h));
                var canvas   = document.createElement('canvas');
                canvas.width  = Math.round(w * pdfScale);
                canvas.height = Math.round(h * pdfScale);
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(objectUrl);

                /* Greyscale */
                var id = ctx.getImageData(0, 0, canvas.width, canvas.height);
                var d  = id.data;
                for (var p = 0; p < d.length; p += 4) {
                    var g = Math.round(0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]);
                    d[p] = d[p + 1] = d[p + 2] = g;
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

            /* Date: field F = YYYYMMDD */
            var dateRaw     = fields['F'] || '';
            var dataemissao = /^\d{8}$/.test(dateRaw)
                ? dateRaw.substring(0, 4) + '-' + dateRaw.substring(4, 6) + '-' + dateRaw.substring(6, 8)
                : '';

            var iKeys     = ['I2','I3','I4','I5','I6','I7','I8','I9','I10','I11','I12'];
            var totalBase = 0, totalIva = 0, dominantBase = 0, dominantRate = 0;
            var usedIdx   = {};
            var brackets  = [];

            for (var i = 0; i < iKeys.length - 1; i++) {
                if (usedIdx[i]) { continue; }
                var base = parseFloat(fields[iKeys[i]]     || '0');
                var iva  = parseFloat(fields[iKeys[i + 1]] || '0');
                if (base <= 0 || iva <= 0) { continue; }
                var rate = iva / base;
                if (rate < 0.01 || rate > 0.30) { continue; }
                totalBase += base;
                totalIva  += iva;
                brackets.push({ taxa: Math.round(rate * 100), base: Math.round(base * 100) / 100, iva: Math.round(iva * 100) / 100 });
                if (base > dominantBase) { dominantBase = base; dominantRate = rate; }
                usedIdx[i] = usedIdx[i + 1] = true;
                i++;
            }

            return {
                nif:         nif,
                dataemissao: dataemissao,
                subtotal:    Math.round(totalBase * 100) / 100,
                iva:         Math.round(totalIva  * 100) / 100,
                taxaiva:     dominantBase > 0 ? Math.round(dominantRate * 100) : 0,
                total:       total,
                ivadetalhes: JSON.stringify(brackets)
            };
        },

        _applyParsed: function (p) {
            this.model.set('nifdocumento', p.nif);
            if (p.dataemissao) { this.model.set('dataemissao', p.dataemissao); }
            this.model.set('subtotal',    p.subtotal);
            this.model.set('iva',         p.iva);
            this.model.set('taxaiva',     p.taxaiva);
            this.model.set('total',       p.total);
            this.model.set('ivadetalhes', p.ivadetalhes);
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
                    self._setSaveDisabled(false);
                    self._setBtnState(qrSuccess ? 'done' : 'idle');
                    self._setStatus(qrSuccess
                        ? 'QR AT lido e PDF guardado'
                        : 'PDF guardado — preenche os campos manualmente');
                }).catch(function (err) {
                    console.error('[QR] upload error', err);
                    self._setSaveDisabled(false);
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
                this.$el.find('.qr-file-input').prop('disabled', true);
                $btn.css('cursor', 'default')
                    .off('click').on('click', function (e) { e.preventDefault(); });
            }
        },

        _setSaveDisabled: function (disabled) {
            $('button[data-action="save"]').prop('disabled', disabled).toggleClass('disabled', disabled);
        },

        _setStatus: function (msg) { this.$el.find('.qr-status').text(msg); },
        _showError:  function (msg) { this.$el.find('.qr-error').text(msg).show(); },
        _clearError: function ()    { this.$el.find('.qr-error').hide().text(''); },

        /* ── Script loader — suppress AMD so UMD assigns to window ─ */

        _loadScript: function (url, globalName, cb) {
            if (window[globalName]) { cb(); return; }
            var self = this;
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
