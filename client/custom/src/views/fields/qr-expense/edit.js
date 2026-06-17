define('custom:views/fields/qr-expense/edit', ['views/fields/base'], function (Dep) {

    var SCAN_TIMEOUT_SEC = 30;
    var BASE_PATH = (function () {
        return window.location.origin + window.location.pathname.split('#')[0].replace(/\/+$/, '');
    }());
    var QR_SCANNER_URL = BASE_PATH + '/client/custom/lib/qr-scanner.umd.min.js';
    var QR_WORKER_URL  = BASE_PATH + '/client/custom/lib/qr-scanner-worker.min.js';
    var JSPDF_URL      = BASE_PATH + '/client/custom/lib/jspdf.umd.min.js';

    return Dep.extend({

        templateContent: '<div class="qr-expense-root"></div>',

        setup: function () {
            Dep.prototype.setup.call(this);
            this._scanning   = false;
            this._qrScanner  = null;
            this._countTimer = null;
        },

        afterRender: function () {
            Dep.prototype.afterRender.call(this);
            if (this.mode === 'detail' || this.mode === 'list') {
                this._buildDetailUI();
            } else {
                this._buildUI();
            }
        },

        /* ── Detail mode ─────────────────────────────────────── */

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

        /* ── Edit mode ───────────────────────────────────────── */

        _buildUI: function () {
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
                    '<button class="btn btn-default qr-btn-scan" type="button" ' +
                    'style="display:flex;align-items:center;gap:6px;padding:7px 14px;">' +
                    '<span class="fas fa-camera" style="font-size:15px;"></span>' +
                    '<span class="qr-btn-label">Scan / Foto</span>' +
                    '</button>' +
                    '<span class="qr-status" style="font-size:13px;color:#888;"></span>' +
                '</div>' +

                /* Camera overlay — A4 portrait guide */
                '<div class="qr-camera-wrap" style="display:none;position:relative;max-width:420px;' +
                'border-radius:10px;overflow:hidden;background:#000;">' +
                    '<video class="qr-video" autoplay playsinline muted ' +
                    'style="width:100%;display:block;max-height:70vh;object-fit:cover;"></video>' +

                    '<canvas class="qr-canvas" style="display:none;"></canvas>' +

                    /* A4 portrait guide (ratio 1:√2 ≈ 0.707) */
                    '<div style="position:absolute;inset:0;display:flex;align-items:center;' +
                    'justify-content:center;pointer-events:none;">' +
                        '<div style="width:72%;aspect-ratio:210/297;' +
                        'border:2px solid rgba(74,144,217,.85);border-radius:4px;' +
                        'box-shadow:0 0 0 2000px rgba(0,0,0,.35);' +
                        'display:flex;align-items:flex-end;justify-content:center;padding-bottom:6px;">' +
                            '<span style="font-size:11px;color:rgba(255,255,255,.8);' +
                            'background:rgba(0,0,0,.4);border-radius:4px;padding:2px 7px;">' +
                            'Enquadra a fatura aqui</span>' +
                        '</div>' +
                    '</div>' +

                    '<div class="qr-countdown" style="position:absolute;top:10px;right:12px;' +
                    'background:rgba(0,0,0,.6);color:#fff;border-radius:20px;' +
                    'padding:3px 11px;font-size:13px;font-weight:600;">' +
                        '<span class="fas fa-clock" style="margin-right:4px;font-size:11px;"></span>' +
                        '<span class="qr-secs">' + SCAN_TIMEOUT_SEC + '</span>s' +
                    '</div>' +

                    '<div style="position:absolute;bottom:10px;left:0;right:0;' +
                    'display:flex;justify-content:center;gap:10px;">' +
                        '<button class="btn qr-btn-cancel" type="button" ' +
                        'style="background:rgba(0,0,0,.55);color:#fff;border:none;' +
                        'border-radius:20px;padding:5px 18px;font-size:12px;">Cancelar</button>' +
                        '<button class="btn qr-btn-capture" type="button" ' +
                        'style="background:rgba(74,144,217,.85);color:#fff;border:none;' +
                        'border-radius:20px;padding:5px 18px;font-size:12px;">' +
                        '<span class="fas fa-camera" style="margin-right:5px;"></span>Capturar foto</button>' +
                    '</div>' +
                '</div>' +

                attachHtml +
                '<div class="qr-error" style="display:none;color:#e74c3c;font-size:13px;margin-top:5px;"></div>';

            this.$el.find('.qr-expense-root').html(html);

            this.$el.find('.qr-btn-scan').on('click', function () {
                this._startScan();
            }.bind(this));

            this.$el.find('.qr-btn-cancel').on('click', function () {
                this._stopCamera();
            }.bind(this));
        },

        /* ── Scan flow ───────────────────────────────────────── */

        _startScan: function () {
            this._clearError();
            this._setStatus('A carregar...');
            this._setBtnState('loading');

            var self = this;
            this._loadScript(QR_SCANNER_URL, 'QrScanner', function () {
                self._scanning = true;
                self._openCameraUI();
            });
        },

        _openCameraUI: function () {
            var self   = this;
            var $wrap  = this.$el.find('.qr-camera-wrap');
            var video  = this.$el.find('.qr-video')[0];
            var canvas = this.$el.find('.qr-canvas')[0];
            var ctx    = canvas.getContext('2d');

            $wrap.show();
            this._setBtnState('scanning');
            this._setStatus('Aponta a camera ao QR code da fatura...');

            window.QrScanner.WORKER_PATH = QR_WORKER_URL;

            this._qrScanner = new window.QrScanner(
                video,
                function (result) {
                    var raw = (result && result.data) ? result.data : String(result);
                    console.log('[QR] raw:', raw.substring(0, 200));

                    var parsed = self._parseQrAT(raw);
                    if (!parsed) {
                        self._setStatus('QR lido mas nao e formato AT...');
                        return;
                    }

                    if (self._countTimer) { clearInterval(self._countTimer); self._countTimer = null; }
                    self._applyParsed(parsed);
                    self._captureFrame(canvas, ctx, video, true);
                },
                {
                    returnDetailedScanResult: true,
                    preferredCamera:          'environment',
                    highlightScanRegion:      false,
                    highlightCodeOutline:     false
                }
            );

            this._qrScanner.start().catch(function (err) {
                self._stopCamera();
                self._showError('Sem acesso a camera: ' + (err.message || err));
            });

            /* Countdown */
            var remaining = SCAN_TIMEOUT_SEC;
            var $secs = this.$el.find('.qr-secs');
            this._countTimer = setInterval(function () {
                remaining -= 1;
                $secs.text(remaining);
                if (remaining <= 0) {
                    clearInterval(self._countTimer);
                    self._countTimer = null;
                    self._captureFrame(canvas, ctx, video, false);
                }
            }, 1000);

            /* Manual capture button */
            this.$el.find('.qr-btn-capture').off('click').on('click', function () {
                if (self._countTimer) { clearInterval(self._countTimer); self._countTimer = null; }
                self._captureFrame(canvas, ctx, video, false);
            });
        },

        _captureFrame: function (canvas, ctx, video, qrSuccess) {
            if (this._qrScanner) { this._qrScanner.stop(); }

            canvas.width  = video.videoWidth  || 1280;
            canvas.height = video.videoHeight || 720;
            if (video.readyState >= video.HAVE_ENOUGH_DATA) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            }

            this._stopCamera();
            this._setStatus('A converter para PDF...');
            this._convertToPdfAndUpload(canvas, qrSuccess);
        },

        /* ── PDF conversion ──────────────────────────────────── */

        _convertToPdfAndUpload: function (canvas, qrSuccess) {
            var self = this;

            this._loadScript(JSPDF_URL, 'jspdf', function () {
                var JsPDF   = window.jspdf.jsPDF;
                var imgData = canvas.toDataURL('image/jpeg', 0.88);

                /* Fit image into A4 with 8mm margin, portrait */
                var a4W = 210, a4H = 297, margin = 8;
                var maxW = a4W - 2 * margin;
                var maxH = a4H - 2 * margin;
                var ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
                var fitW  = canvas.width  * ratio;
                var fitH  = canvas.height * ratio;
                var x     = (a4W - fitW) / 2;
                var y     = (a4H - fitH) / 2;

                var pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                pdf.addImage(imgData, 'JPEG', x, y, fitW, fitH);

                var pdfBlob = pdf.output('blob');
                self._setStatus('A enviar PDF...');
                self._uploadBlob(pdfBlob, qrSuccess);
            });
        },

        /* ── QR AT parser ────────────────────────────────────── */

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
            var pairs = [
                { base: parseFloat(fields['I2'] || '0'), iva: parseFloat(fields['I3'] || '0') },
                { base: parseFloat(fields['I4'] || '0'), iva: parseFloat(fields['I5'] || '0') },
                { base: parseFloat(fields['I6'] || '0'), iva: parseFloat(fields['I7'] || '0') }
            ];
            var best = pairs.reduce(function (a, b) { return b.base > a.base ? b : a; }, { base: 0, iva: 0 });

            return {
                nif:      nif,
                subtotal: best.base,
                iva:      best.iva,
                taxaiva:  best.base > 0 ? Math.round((best.iva / best.base) * 100) : 0,
                total:    total
            };
        },

        _applyParsed: function (p) {
            this.model.set('nifdocumento', p.nif);
            this.model.set('subtotal',     p.subtotal);
            this.model.set('iva',          p.iva);
            this.model.set('taxaiva',      p.taxaiva);
            this.model.set('total',        p.total);
            this._setStatus(
                'QR AT: NIF ' + p.nif + ' | Total ' + p.total.toFixed(2) + '€ | IVA ' + p.taxaiva + '%'
            );
        },

        /* ── Upload ──────────────────────────────────────────── */

        _uploadBlob: function (blob, qrSuccess) {
            var self     = this;
            var fileName = 'fatura-' + Date.now() + '.pdf';
            var reader   = new FileReader();

            reader.onload = function (e) {
                var payload = {
                    name:       fileName,
                    type:       'application/pdf',
                    parentType: 'Contabdoc',
                    field:      'documentocontab',
                    role:       'Attachment',
                    file:       e.target.result
                };

                Espo.Ajax.postRequest('Attachment', payload)
                    .then(function (resp) {
                        if (resp && resp.id) {
                            self.model.set('documentocontabId',   resp.id);
                            self.model.set('documentocontabName', resp.name || fileName);
                            self._updateAttachLine(resp.id, resp.name || fileName);
                        }
                        self._setBtnState(qrSuccess ? 'done' : 'idle');
                        if (!qrSuccess) {
                            self._setStatus('Sem QR AT — PDF guardado, preenche manualmente');
                        }
                    })
                    .catch(function (err) {
                        console.error('[QR] upload error', err);
                        self._setBtnState(qrSuccess ? 'done' : 'idle');
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

        /* ── UI helpers ──────────────────────────────────────── */

        _setBtnState: function (state) {
            var $btn   = this.$el.find('.qr-btn-scan');
            var $label = this.$el.find('.qr-btn-label');
            var $icon  = $btn.find('.fas');
            $btn.prop('disabled', state === 'loading' || state === 'scanning');
            if (state === 'idle') {
                $icon.attr('class', 'fas fa-camera').css('font-size', '15px');
                $label.text('Scan / Foto');
                $btn.removeClass('btn-success btn-warning').addClass('btn-default');
            } else if (state === 'loading') {
                $icon.attr('class', 'fas fa-spinner fa-spin');
                $label.text('A carregar...');
                $btn.removeClass('btn-success btn-warning').addClass('btn-default');
            } else if (state === 'scanning') {
                $icon.attr('class', 'fas fa-camera').css('font-size', '15px');
                $label.text('A ler...');
            } else if (state === 'done') {
                $icon.attr('class', 'fas fa-check');
                $label.text('QR lido');
                $btn.removeClass('btn-default btn-warning').addClass('btn-success');
            }
        },

        _setStatus: function (msg) { this.$el.find('.qr-status').text(msg); },
        _showError:  function (msg) { this.$el.find('.qr-error').text(msg).show(); },
        _clearError: function ()    { this.$el.find('.qr-error').hide().text(''); },

        /* ── Camera teardown ─────────────────────────────────── */

        _stopCamera: function () {
            this._scanning = false;
            if (this._countTimer) { clearInterval(this._countTimer); this._countTimer = null; }
            if (this._qrScanner) {
                try { this._qrScanner.stop(); this._qrScanner.destroy(); } catch (e) {}
                this._qrScanner = null;
            }
            this.$el.find('.qr-camera-wrap').hide();
            this._setBtnState(this.model.get('documentocontabId') ? 'done' : 'idle');
        },

        /* ── Generic script loader with AMD suppression ──────── */

        _loadScript: function (url, globalName, cb) {
            if (window[globalName]) { cb(); return; }
            var self = this;
            var savedDefine = window.define;
            window.define = undefined;
            var script = document.createElement('script');
            script.src = url;
            script.onload = function () {
                window.define = savedDefine;
                cb();
            };
            script.onerror = function () {
                window.define = savedDefine;
                self._showError('Erro ao carregar ' + globalName + '.');
                self._setBtnState('idle');
            };
            document.head.appendChild(script);
        },

        onRemove: function () {
            this._stopCamera();
            Dep.prototype.onRemove.call(this);
        }
    });
});
