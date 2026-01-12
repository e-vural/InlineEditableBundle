/**
 * Inline Edit Manager - Vanilla JS Event Delegation Version
 * 
 * Event delegation ile tek bir listener ile tüm inline-edit field'larını yönetir.
 * SDK gibi çalışır - dış plugin'lere bağımlı değildir. Event-based sistem kullanır.
 * 
 * Event Sistemi:
 * - 'opened': Edit mode açıldığında emit edilir
 * - 'clicked': Edit butonuna tıklandığında emit edilir
 * - 'save': Save işlemi başlamadan önce emit edilir
 * - 'saved': Save işlemi başarıyla tamamlandığında emit edilir
 * - 'cancel': Cancel işlemi yapıldığında emit edilir
 * - 'rejected': Cancel işlemi yapıldığında emit edilir (alias)
 * - 'error': Hata oluştuğunda emit edilir
 * - 'closed': Edit mode kapandığında emit edilir (save veya cancel sonrası)
 * 
 * Kullanım:
 * ```javascript
 * // Global instance
 * const inlineEditManager = new InlineEditManager()
 * 
 * // Event dinleme
 * inlineEditManager.on('opened', (data) => {
 *   // Edit mode açıldı
 *   const { field, fieldData, input } = data
 *   // Choices.js gibi plugin'leri burada yönetebilirsiniz
 *   if (input && input.hasAttribute('data-choices')) {
 *     // Choices.js instance'ını bul ve yönet
 *   }
 * })
 * 
 * inlineEditManager.on('save', (data) => {
 *   // Save başlamadan önce
 *   const { field, value, input } = data
 *   // Plugin'leri burada kontrol edebilirsiniz
 * })
 * 
 * inlineEditManager.on('cancel', (data) => {
 *   // Cancel edildiğinde
 *   const { field, input, originalValue } = data
 *   // Plugin'leri burada reset edebilirsiniz
 * })
 * ```
 * 
 * HTML Yapısı:
 * <div class="inline-edit-field" 
 *      data-inline-edit-manager="true"
 *      data-inline-edit-url="/personel/1/field/name"
 *      data-inline-edit-field-path="personel.name"
 *      data-inline-edit-value="Mehmet"
 *      data-inline-edit-input-type="input"
 *      data-inline-edit-html-type="text"
 *      data-inline-edit-placeholder="Ad giriniz">
 *   <div class="inline-edit-read" data-inline-edit-read-mode>
 *     <span data-inline-edit-editable>Mehmet</span>
 *     <button type="button" data-inline-edit-enable>Edit</button>
 *   </div>
 *   <div class="inline-edit-edit d-none" data-inline-edit-edit-mode>
 *     <input type="text" data-inline-edit-input value="Mehmet">
 *     <button type="button" data-inline-edit-save>Save</button>
 *     <button type="button" data-inline-edit-cancel>Cancel</button>
 *     <div class="invalid-feedback d-block" data-inline-edit-error></div>
 *   </div>
 * </div>
 */
class InlineEditManager {
    constructor() {
        this.activeField = null // Aktif edit mode olan field container
        this.activeFieldData = null // Aktif field'ın data'sı
        this.boundHandleClickOutside = null
        this.isInitialized = false // Initialization flag
        this.boundHandleClick = null // Click handler reference
        this.boundHandleKeydown = null // Keydown handler reference
        this.eventListeners = {
            opened: [],
            save: [],
            saved: [],
            cancel: [],
            rejected: [],
            clicked: [],
            error: [],
            closed: []
        }
        this.init()
    }

    /**
     * Event listener ekle
     * @param {string} eventName - Event adı: 'opened', 'save', 'saved', 'cancel', 'rejected', 'clicked', 'error', 'closed'
     * @param {Function} callback - Callback fonksiyonu
     */
    on(eventName, callback) {
        if (this.eventListeners[eventName]) {
            this.eventListeners[eventName].push(callback)
        } else {
            console.warn(`Unknown event: ${eventName}`)
        }
    }

    /**
     * Event listener kaldır
     * @param {string} eventName - Event adı
     * @param {Function} callback - Kaldırılacak callback fonksiyonu
     */
    off(eventName, callback) {
        if (this.eventListeners[eventName]) {
            const index = this.eventListeners[eventName].indexOf(callback)
            if (index > -1) {
                this.eventListeners[eventName].splice(index, 1)
            }
        }
    }

    /**
     * Event emit et
     * @param {string} eventName - Event adı
     * @param {Object} data - Event data'sı
     */
    emit(eventName, data = {}) {
        if (this.eventListeners[eventName]) {
            this.eventListeners[eventName].forEach(callback => {
                try {
                    callback({
                        ...data,
                        field: data.field || this.activeField,
                        fieldData: data.fieldData || this.activeFieldData
                    })
                } catch (error) {
                    console.error(`Error in event listener for ${eventName}:`, error)
                }
            })
        }
    }

    init() {
        // Eğer zaten init edildiyse tekrar init etme
        if (this.isInitialized) {
            return
        }

        this.isInitialized = true

        // Event delegation - tek listener tüm click'leri yakalar
        this.boundHandleClick = (e) => {
            // Sadece data-inline-edit-manager="true" olan field'ları işle
            const field = e.target.closest('[data-inline-edit-manager="true"]')
            
            // Enable edit butonuna tıklama (öncelikli kontrol)
            if (e.target.matches('[data-inline-edit-enable]') || e.target.closest('[data-inline-edit-enable]')) {
                if (field) {
                    this.enableEdit(field, e)
                }
                return
            }

            // Read mode içine tıklama (editable area veya read mode container)
            if (field) {
                const readMode = field.querySelector('[data-inline-edit-read-mode]')
                if (readMode && readMode.contains(e.target)) {
                    // Edit mode açık değilse enable edit yap
                    const editMode = field.querySelector('[data-inline-edit-edit-mode]')
                    if (editMode && editMode.classList.contains('d-none')) {
                        this.enableEdit(field, e)
                    }
                    return
                }
            }

            // Save butonuna tıklama
            if (e.target.matches('[data-inline-edit-save]') || e.target.closest('[data-inline-edit-save]')) {
                // Popover içindeki butonlar için aktif field'ı kullan
                const targetField = field || this.activeField
                if (targetField) {
                    this.save(targetField, e)
                }
                return
            }

            // Cancel butonuna tıklama
            if (e.target.matches('[data-inline-edit-cancel]') || e.target.closest('[data-inline-edit-cancel]')) {
                // Popover içindeki butonlar için aktif field'ı kullan
                const targetField = field || this.activeField
                if (targetField) {
                    this.cancel(targetField, e)
                }
                return
            }

            // Click outside - aktif field varsa ve dışına tıklandıysa cancel yap
            if (this.activeField && !this.activeField.contains(e.target)) {
                const fieldEditMode = this.activeField.dataset.inlineEditMode || 'inline'
                
                // Popover modu için popover element'ini de kontrol et
                if (fieldEditMode === 'popup') {
                    const popoverElement = document.querySelector('.popover')
                    const triggerBtn = this.activeField.querySelector('[data-inline-edit-enable]')
                    
                    // Popover içine veya trigger button'a tıklanmadıysa cancel yap
                    if (popoverElement && !popoverElement.contains(e.target) && 
                        triggerBtn && !triggerBtn.contains(e.target)) {
                        this.cancel(this.activeField)
                    }
                } else {
                    // Inline modu için mevcut kontrol
                    const editMode = this.activeField.querySelector('[data-inline-edit-edit-mode]')
                    if (editMode && !editMode.contains(e.target)) {
                        this.cancel(this.activeField)
                    }
                }
            }
        }

        // Click event listener'ı ekle
        document.addEventListener('click', this.boundHandleClick)

        // Keyboard shortcuts - tek listener
        this.boundHandleKeydown = (e) => {
            if (!this.activeField) return

            const input = this.activeField.querySelector('[data-inline-edit-input]')
            if (!input || document.activeElement !== input) {
                return
            }

            // Enter = Save
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                this.save(this.activeField)
                return
            }

            // Escape = Cancel
            if (e.key === 'Escape') {
                e.preventDefault()
                this.cancel(this.activeField)
                return
            }
        }

        // Keydown event listener'ı ekle
        document.addEventListener('keydown', this.boundHandleKeydown)
    }

    /**
     * Cleanup - event listener'ları kaldır
     */
    destroy() {
        if (this.boundHandleClick) {
            document.removeEventListener('click', this.boundHandleClick)
            this.boundHandleClick = null
        }
        
        if (this.boundHandleKeydown) {
            document.removeEventListener('keydown', this.boundHandleKeydown)
            this.boundHandleKeydown = null
        }

        if (this.boundHandleClickOutside) {
            document.removeEventListener('click', this.boundHandleClickOutside, true)
            this.boundHandleClickOutside = null
        }

        this.isInitialized = false
    }

    /**
     * Bundle'ın açtığı tüm açık popover'ları kapatır
     */
    closeAllOpenPopovers() {
        // Tüm inline-edit-field elementlerini bul
        const allFields = document.querySelectorAll('[data-inline-edit-manager="true"]')
        
        allFields.forEach(field => {
            // Sadece popover modunda olan field'ları kontrol et
            const editMode = field.dataset.inlineEditMode || 'inline'
            if (editMode !== 'popup') return
            
            // Popover instance'ı varsa kapat
            if (field._popoverInstance) {
                try {
                    const triggerButton = field.querySelector('[data-inline-edit-enable]')
                    if (triggerButton) {
                        const instance = bootstrap.Popover.getInstance(triggerButton)
                        if (instance === field._popoverInstance) {
                            // Popover'ı hide et ve dispose et
                            instance.hide()
                            instance.dispose()
                        }
                    }
                } catch (error) {
                    console.warn('Error disposing popover instance:', error)
                } finally {
                    field._popoverInstance = null
                }
            }
        })
    }

    /**
     * Edit mode'u aktif eder
     */
    enableEdit(fieldElement, event) {
        if (event) {
            event.preventDefault()
            event.stopPropagation()
        }

        // Bundle'ın açtığı tüm açık popover'ları kapat (ekran dışında kalanlar dahil)
        this.closeAllOpenPopovers()

        // Eğer başka bir field edit mode'daysa önce onu kapat
        if (this.activeField && this.activeField !== fieldElement) {
            this.cancel(this.activeField)
        }

        // Data attribute'lardan bilgileri oku
        const url = fieldElement.dataset.inlineEditUrl
        const fieldPath = fieldElement.dataset.inlineEditFieldPath || ''
        const originalValue = fieldElement.dataset.inlineEditValue || ''
        const inputType = fieldElement.dataset.inlineEditInputType || 'input'
        const htmlType = fieldElement.dataset.inlineEditHtmlType || 'text'
        const placeholder = fieldElement.dataset.inlineEditPlaceholder || ''
        const editMode = fieldElement.dataset.inlineEditMode || 'inline'

        // Read mode'u bul
        const readMode = fieldElement.querySelector('[data-inline-edit-read-mode]')
        
        if (!readMode) {
            console.warn('Inline edit field structure invalid:', fieldElement)
            return
        }

        // Popover modu için özel işlem
        if (editMode === 'popup') {
            return this.enableEditPopover(fieldElement, {
                url,
                fieldPath,
                originalValue,
                inputType,
                htmlType,
                placeholder,
                readMode
            })
        }

        // Inline modu için edit mode'u bul
        const editModeElement = fieldElement.querySelector('[data-inline-edit-edit-mode]')
        if (!editModeElement) {
            console.warn('Edit mode element not found for inline mode:', fieldElement)
            return
        }

        // Edit mode zaten açıksa
        if (editModeElement && !editModeElement.classList.contains('d-none')) {
            return
        }

        // Template element'inden content'i clone'la
        const contentTemplate = fieldElement.querySelector('[data-inline-edit-content-template]')
        if (!contentTemplate) {
            console.warn('Content template not found:', fieldElement)
            return
        }

        // Template content'ini clone'la
        const contentClone = contentTemplate.content.cloneNode(true)
        
        // Input'u bul ve ayarla
        const input = contentClone.querySelector('[data-inline-edit-input]')
        if (input) {
            if (inputType === 'input' && input.tagName === 'INPUT') {
                input.type = htmlType
            }
            if (placeholder) {
                input.placeholder = placeholder
            }
            
            // Güncel değeri kullan (dataset'ten al, çünkü updateFieldValue ile güncellenmiş olabilir)
            const currentValue = fieldElement.dataset.inlineEditValue || originalValue
            this.setInputValue(input, currentValue)
        }

        // Edit mode container'ı temizle ve clone'lanmış content'i ekle
        editModeElement.innerHTML = ''
        editModeElement.appendChild(contentClone)

        // Edit mode'u aç
        readMode.classList.add('d-none')
        editModeElement.classList.remove('d-none')

        // DOM'a eklendikten sonra gerçek form element'ini bul
        const formElement = editModeElement.querySelector('[data-inline-edit-input]')

        // Form element'ini focus et
        if (formElement) {
            setTimeout(() => {
                formElement.focus()
                if (inputType === 'input' && formElement.tagName === 'INPUT') {
                    formElement.select()
                }
            }, 50)
        }

        // Aktif field'ı kaydet
        this.activeField = fieldElement
        // Güncel değeri kullan
        const currentValue = fieldElement.dataset.inlineEditValue || originalValue
        this.activeFieldData = {
            url,
            fieldPath,
            originalValue: currentValue,
            inputType,
            htmlType,
            placeholder,
            editMode: 'inline'
        }

        // Eski click outside listener'ı kaldır (eğer varsa)
        if (this.boundHandleClickOutside) {
            document.removeEventListener('click', this.boundHandleClickOutside, true)
        }

        // Click outside listener ekle
        this.boundHandleClickOutside = (e) => {
            if (!this.activeField || this.activeField !== fieldElement) return
            
            const activeEditMode = this.activeField.querySelector('[data-inline-edit-edit-mode]')
            if (!activeEditMode) return
            
            // Edit mode içindeki elementlere tıklanmadıysa cancel yap
            if (!activeEditMode.contains(e.target)) {
                this.cancel(this.activeField)
            }
        }

        // Capture phase'de dinle (biraz gecikmeyle ki enable edit event'i tamamlansın)
        setTimeout(() => {
            document.addEventListener('click', this.boundHandleClickOutside, true)
        }, 0)

        // Error mesajını temizle
        this.clearError(fieldElement)

        // Event emit: opened (edit mode açıldı)
        this.emit('opened', {
            field: fieldElement,
            fieldData: this.activeFieldData,
            formElement: formElement
        })

        // Event emit: clicked (edit butonuna tıklandı)
        this.emit('clicked', {
            field: fieldElement,
            fieldData: this.activeFieldData,
            formElement: formElement
        })
    }

    /**
     * Popover modu için edit mode'u aktif eder
     */
    enableEditPopover(fieldElement, config) {
        const { url, fieldPath, originalValue, inputType, htmlType, placeholder, readMode } = config

        // Trigger button'u bul
        const triggerButton = readMode.querySelector('[data-inline-edit-enable]')
        if (!triggerButton) {
            console.warn('Popover trigger button not found:', fieldElement)
            return
        }

        // Eğer zaten bir popover instance varsa dispose et
        if (fieldElement._popoverInstance) {
            try {
                const triggerButton = readMode.querySelector('[data-inline-edit-enable]')
                if (triggerButton) {
                    const instance = bootstrap.Popover.getInstance(triggerButton)
                    if (instance === fieldElement._popoverInstance) {
                        fieldElement._popoverInstance.dispose()
                    }
                }
            } catch (error) {
                console.warn('Popover dispose error:', error)
            } finally {
                fieldElement._popoverInstance = null
            }
        }

        // Template element'inden content'i clone'la
        const contentTemplate = fieldElement.querySelector('[data-inline-edit-content-template]')
        if (!contentTemplate) {
            console.warn('Content template not found:', fieldElement)
            return
        }

        // Template content'ini clone'la
        const contentClone = contentTemplate.content.cloneNode(true)
        
        // Clone'lanmış tüm elementlere data-real="true" ekle
        const allElements = contentClone.querySelectorAll('*')
        allElements.forEach(el => {
            el.setAttribute('data-real', 'true')
        })
        // Clone'lanmış root element'e de ekle
        if (contentClone.firstElementChild) {
            contentClone.firstElementChild.setAttribute('data-real', 'true')
        }
        
        const input = contentClone.querySelector('[data-inline-edit-input]')
        
        if (input) {
            if (inputType === 'input' && input.tagName === 'INPUT') {
                input.type = htmlType
            }
            if (placeholder) {
                input.placeholder = placeholder
            }
            
            // Güncel değeri kullan (dataset'ten al, çünkü updateFieldValue ile güncellenmiş olabilir)
            const currentValue = fieldElement.dataset.inlineEditValue || originalValue
            this.setInputValue(input, currentValue)
        }

        // Clone'lanmış content'i bir div'e koy ve HTML string'ini al
        const tempDiv = document.createElement('div')
        tempDiv.appendChild(contentClone)
        const popoverContentHtml = tempDiv.innerHTML

        // Bootstrap Popover instance oluştur
        const popoverInstance = new bootstrap.Popover(triggerButton, {
            trigger: 'manual',
            placement: 'auto',
            container: 'body',
            html: true,
            sanitize: false,
            content: popoverContentHtml,
            title: 'Düzenle'
        })

        // Popover instance'ı field element'ine kaydet
        fieldElement._popoverInstance = popoverInstance

        // Aktif field'ı kaydet
        this.activeField = fieldElement
        // Güncel değeri kullan
        const currentValue = fieldElement.dataset.inlineEditValue || originalValue
        this.activeFieldData = {
            url,
            fieldPath,
            originalValue: currentValue,
            inputType,
            htmlType,
            placeholder,
            editMode: 'popup',
            popoverInstance: popoverInstance
        }

        // Popover event listener'ları ekle
        const handlePopoverShown = () => {
            // Popover gösterildiğinde form element'ini focus et ve opened event'ini emit et
            setTimeout(() => {
                // Popover element'ini DOM'dan bul (shown.bs.popover event'i tetiklendiğinde popover zaten DOM'da)
                const popoverElement = document.querySelector('.popover')
                if (!popoverElement) return
                
                const popoverBody = popoverElement.querySelector('.popover-body')
                if (!popoverBody) return
                
                const formElement = popoverBody.querySelector('[data-inline-edit-input]')
                if (formElement) {
                    formElement.focus()
                    if (inputType === 'input' && formElement.tagName === 'INPUT') {
                        formElement.select()
                    }
                    
                    // Popover içindeki gerçek form element ile opened event'ini emit et
                    this.emit('opened', {
                        field: fieldElement,
                        fieldData: this.activeFieldData,
                        formElement: formElement
                    })
                }
            }, 100)
        }

        const handlePopoverHidden = () => {
            // Popover gizlendiğinde, güncel HTML'i template'e kaydet
            const popoverElement = document.querySelector('.popover')
            if (popoverElement && this.activeField === fieldElement) {
                const popoverBody = popoverElement.querySelector('.popover-body')
                if (popoverBody) {
                    // Popover'daki güncel content'i template'e kaydet
                    const contentTemplate = fieldElement.querySelector('[data-inline-edit-content-template]')
                    if (contentTemplate) {
                        // Popover'daki select elementlerinin selected attribute'larını güncelle
                        const selectInPopover = popoverBody.querySelector('select[data-inline-edit-input]')
                        if (selectInPopover) {
                            Array.from(selectInPopover.options).forEach(option => {
                                if (option.selected) {
                                    option.setAttribute('selected', 'selected')
                                } else {
                                    option.removeAttribute('selected')
                                }
                            })
                        }
                        
                        // Popover'daki HTML'i al
                        const popoverHtml = popoverBody.innerHTML
                        
                        // Template içeriğini güncelle
                        // Not: Template element'inin content property'si read-only olduğu için
                        // innerHTML kullanarak güncelliyoruz (template element'i normal element gibi davranır)
                        contentTemplate.innerHTML = popoverHtml
                    }
                }
            }
            
            // NOT: Popover instance'ı burada dispose etme
            // closeEditMode içinde dispose edilecek
            // Bu şekilde çift dispose önlenir
        }

        triggerButton.addEventListener('shown.bs.popover', handlePopoverShown)
        triggerButton.addEventListener('hidden.bs.popover', handlePopoverHidden)

        // Eski click outside listener'ı kaldır (eğer varsa)
        if (this.boundHandleClickOutside) {
            document.removeEventListener('click', this.boundHandleClickOutside, true)
        }

        // Click outside listener ekle (popover için)
        this.boundHandleClickOutside = (e) => {
            if (!this.activeField || this.activeField !== fieldElement) return
            
            const popoverElement = document.querySelector('.popover')
            const triggerBtn = fieldElement.querySelector('[data-inline-edit-enable]')
            
            // Popover içine veya trigger button'a tıklanmadıysa cancel yap
            if (popoverElement && !popoverElement.contains(e.target) && 
                triggerBtn && !triggerBtn.contains(e.target)) {
                this.cancel(this.activeField)
            }
        }

        // Capture phase'de dinle
        setTimeout(() => {
            document.addEventListener('click', this.boundHandleClickOutside, true)
        }, 0)

        // Error mesajını temizle
        this.clearError(fieldElement)

        // Popover'ı göster
        popoverInstance.show()

        // NOT: opened event'ini burada emit etme, handlePopoverShown içinde emit edilecek
        // Çünkü popover gösterilmeden önce popover içindeki gerçek element'e erişemeyiz

        // Event emit: clicked (edit butonuna tıklandı)
        this.emit('clicked', {
            field: fieldElement,
            fieldData: this.activeFieldData,
            formElement: input // Clone'daki form element (henüz DOM'da değil)
        })
    }

    /**
     * Edit mode'u kapatır ve değişiklikleri kaydeder
     */
    async save(fieldElement, event) {
        if (event) {
            event.preventDefault()
            event.stopPropagation()
        }

        if (!fieldElement || fieldElement !== this.activeField) {
            return
        }

        const editMode = fieldElement.dataset.inlineEditMode || 'inline'
        let formElement = null

        // Popover modu için popover içindeki form element'ini bul
        if (editMode === 'popup') {
            const popoverElement = document.querySelector('.popover')
            if (!popoverElement) {
                return
            }
            formElement = popoverElement.querySelector('[data-inline-edit-input]')
            if (!formElement) {
                return
            }
        } else {
            // Inline modu için mevcut işlem
            const editModeElement = fieldElement.querySelector('[data-inline-edit-edit-mode]')
            if (!editModeElement || editModeElement.classList.contains('d-none')) {
                return
            }
            formElement = editModeElement.querySelector('[data-inline-edit-input]')
            if (!formElement) {
                return
            }
        }

        // Form element değerini al
        const { value: newValue, isMultiple, selectedTexts } = this.getInputValue(formElement)
        
        // Değerleri normalize et ve karşılaştır
        const newValueStr = this.normalizeValueForComparison(newValue)
        const oldValueStr = this.normalizeValueForComparison(this.activeFieldData?.originalValue || '')
        
        // Değer değişmediyse sadece edit mode'u kapat
        if (newValueStr === oldValueStr) {
            this.closeEditMode(fieldElement, 'no_change')
            return
        }

        // Event emit: save (save başlamadan önce)
        this.emit('save', {
            field: fieldElement,
            fieldData: this.activeFieldData,
            value: newValue,
            isMultiple: isMultiple,
            formElement: formElement,
            preventDefault: false
        })

        // Loading state
        this.setLoadingState(fieldElement, true)

        try {
            // PATCH request gönder
            const response = await this.submitPatch(newValue, isMultiple)

            // Response'u handle et (selectedTexts'i de gönder)
            await this.handleResponse(response, newValue, fieldElement, selectedTexts)
        } catch (error) {
            console.error('Save error:', error)
            this.showError(fieldElement, 'Kaydetme sırasında bir hata oluştu. Lütfen tekrar deneyin.')
            this.setLoadingState(fieldElement, false)

            // Event emit: error
            this.emit('error', {
                field: fieldElement,
                fieldData: this.activeFieldData,
                formElement: formElement,
                error: error,
                action: 'save'
            })
        }
    }

    /**
     * Edit mode'u kapatır ve değişiklikleri iptal eder
     */
    cancel(fieldElement, event) {
        if (event) {
            event.preventDefault()
            event.stopPropagation()
        }

        if (!fieldElement) {
            return
        }

        const editMode = fieldElement.dataset.inlineEditMode || 'inline'
        
        // Popover modu için özel işlem
        if (editMode === 'popup') {
            // Click outside listener'ı kaldır
            if (this.boundHandleClickOutside) {
                document.removeEventListener('click', this.boundHandleClickOutside, true)
                this.boundHandleClickOutside = null
            }

            // Original değere geri dön (popover içindeki form element)
            const popoverElement = document.querySelector('.popover')
            let formElement = null
            if (popoverElement) {
                formElement = popoverElement.querySelector('[data-inline-edit-input]')
                if (formElement && this.activeFieldData) {
                    this.setInputValue(formElement, this.activeFieldData.originalValue)
                }
            }

            // Event emit: cancel (iptal edildi)
            this.emit('cancel', {
                field: fieldElement,
                fieldData: this.activeFieldData,
                formElement: formElement,
                originalValue: this.activeFieldData?.originalValue
            })

            // Event emit: rejected (iptal edildi - alias)
            this.emit('rejected', {
                field: fieldElement,
                fieldData: this.activeFieldData,
                formElement: formElement,
                originalValue: this.activeFieldData?.originalValue
            })

            // Edit mode'u kapat (popover dispose edilecek)
            this.closeEditMode(fieldElement, 'cancelled')
            return
        }

        // Inline modu için mevcut işlem
        const editModeElement = fieldElement.querySelector('[data-inline-edit-edit-mode]')
        if (!editModeElement || editModeElement.classList.contains('d-none')) {
            return
        }

        // Click outside listener'ı kaldır
        if (this.boundHandleClickOutside) {
            document.removeEventListener('click', this.boundHandleClickOutside, true)
            this.boundHandleClickOutside = null
        }

        // Original değere geri dön
        const formElement = editModeElement.querySelector('[data-inline-edit-input]')
        if (formElement && this.activeFieldData) {
            this.setInputValue(formElement, this.activeFieldData.originalValue)
        }

        // Event emit: cancel (iptal edildi)
        this.emit('cancel', {
            field: fieldElement,
            fieldData: this.activeFieldData,
            formElement: formElement,
            originalValue: this.activeFieldData?.originalValue
        })

        // Event emit: rejected (iptal edildi - alias)
        this.emit('rejected', {
            field: fieldElement,
            fieldData: this.activeFieldData,
            formElement: formElement,
            originalValue: this.activeFieldData?.originalValue
        })

        // Edit mode'u kapat
        this.closeEditMode(fieldElement, 'cancelled')
    }

    /**
     * PATCH request gönderir
     */
    async submitPatch(value, isMultiple = false) {
        if (!this.activeFieldData) {
            throw new Error('Active field data not found')
        }

        const url = this.activeFieldData.url
        const fieldPath = this.activeFieldData.fieldPath

        // Field path'i URL-encoded formatına çevir
        const body = this.buildUrlEncodedBody(fieldPath, value, isMultiple)

        // Headers
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }

        // CSRF token ekle (eğer varsa)
        const csrfToken = this.getCsrfToken()
        if (csrfToken) {
            headers['X-CSRF-TOKEN'] = csrfToken
        }

        // Fetch request (PATCH metodu)
        const response = await fetch(url, {
            method: 'PATCH',
            headers: headers,
            body: body,
            credentials: 'same-origin'
        })

        return response
    }

    /**
     * Field path'i URL-encoded formatına çevirir
     * Örnek: "personel.name" -> "personel[name]=value"
     * Örnek (multiple): "personel.departmanlar" -> "personel[departmanlar][]=value1&personel[departmanlar][]=value2"
     */
    buildUrlEncodedBody(path, value, isMultiple = false) {
        if (!path) {
            if (Array.isArray(value)) {
                return this.buildArrayQueryString('value', value)
            }
            return `value=${encodeURIComponent(value)}`
        }

        const keys = path.split('.') // ["personel", "departmanlar"]

        // Symfony nested form formatı: personel[departmanlar]
        let fieldName = keys[0] // "personel"
        for (let i = 1; i < keys.length; i++) {
            fieldName += `[${keys[i]}]` // "personel" + "[departmanlar]" = "personel[departmanlar]"
        }

        // Multiple select için array formatı
        if (isMultiple && Array.isArray(value)) {
            return this.buildArrayQueryString(fieldName, value)
        }

        // Single value için normal format
        const params = new URLSearchParams()
        params.append(fieldName, value)

        return params.toString()
    }

    /**
     * Response'u handle eder
     */
    async handleResponse(response, newValue, fieldElement, displayValue = null) {
        const contentType = response.headers.get('Content-Type')
        const isJson = contentType && contentType.includes('application/json')

        if (!isJson) {
            throw new Error('Response JSON değil')
        }

        const data = await response.json()

        if (response.ok && response.status === 200) {
            // Başarılı - gönderilen veriyi ekrana bas
            this.updateDOM(newValue, fieldElement, displayValue)
            this.closeEditMode(fieldElement, 'saved')

            // Success notification
            const message = data.message || 'Field başarıyla güncellendi.'
            if (window.flashNotification) {
                window.flashNotification.success(message)
            }

            // Form element'ini bul (saved event için)
            const editMode = fieldElement.dataset.inlineEditMode || 'inline'
            let formElement = null
            if (editMode === 'popup') {
                const popoverElement = document.querySelector('.popover')
                if (popoverElement) {
                    formElement = popoverElement.querySelector('[data-inline-edit-input]')
                }
            } else {
                const editModeElement = fieldElement.querySelector('[data-inline-edit-edit-mode]')
                if (editModeElement) {
                    formElement = editModeElement.querySelector('[data-inline-edit-input]')
                }
            }

            // Event emit: saved (save başarılı)
            this.emit('saved', {
                field: fieldElement,
                fieldData: this.activeFieldData,
                formElement: formElement,
                value: newValue,
                displayValue: displayValue,
                response: data
            })
        } else {
            // Hata durumu
            const errorMessage = this.extractErrorMessage(data, fieldElement)
            this.showError(fieldElement, errorMessage)
            this.setLoadingState(fieldElement, false)

            // Edit mode'u AÇIK TUT (kapatma, kullanıcı hatayı görebilsin ve düzeltebilsin)
            // readMode ve editMode değişikliği yapmıyoruz, edit mode açık kalacak
            
            // Aktif field'ı tutmaya devam et (cancel edilmediği sürece)
            // Kullanıcı hatayı düzeltebilsin

            // Error notification
            if (window.flashNotification) {
                window.flashNotification.error(errorMessage)
            }

            // Form element'ini bul (error event için)
            const editMode = fieldElement.dataset.inlineEditMode || 'inline'
            let formElement = null
            if (editMode === 'popup') {
                const popoverElement = document.querySelector('.popover')
                if (popoverElement) {
                    formElement = popoverElement.querySelector('[data-inline-edit-input]')
                }
            } else {
                const editModeElement = fieldElement.querySelector('[data-inline-edit-edit-mode]')
                if (editModeElement) {
                    formElement = editModeElement.querySelector('[data-inline-edit-input]')
                }
            }

            // Event emit: error (save hatası)
            this.emit('error', {
                field: fieldElement,
                fieldData: this.activeFieldData,
                formElement: formElement,
                error: errorMessage,
                action: 'save',
                response: data
            })
        }
    }

    /**
     * Edit mode'u kapatır ve temizlik yapar
     */
    closeEditMode(fieldElement, reason = 'closed') {
        // Click outside listener'ı kaldır
        if (this.boundHandleClickOutside) {
            document.removeEventListener('click', this.boundHandleClickOutside, true)
            this.boundHandleClickOutside = null
        }

        const editMode = fieldElement.dataset.inlineEditMode || 'inline'

        // Popover modu için özel işlem
        if (editMode === 'popup') {
            // Popover instance'ı dispose et (sadece hala geçerliyse)
            if (fieldElement._popoverInstance) {
                try {
                    // Popover instance'ının hala geçerli olduğunu kontrol et
                    const triggerButton = fieldElement.querySelector('[data-inline-edit-enable]')
                    if (triggerButton) {
                        const instance = bootstrap.Popover.getInstance(triggerButton)
                        if (instance === fieldElement._popoverInstance) {
                            fieldElement._popoverInstance.dispose()
                        }
                    }
                } catch (error) {
                    console.warn('Popover dispose error:', error)
                } finally {
                    fieldElement._popoverInstance = null
                }
            }
        } else {
            // Inline modu için read mode ve edit mode geçişi
            const readMode = fieldElement.querySelector('[data-inline-edit-read-mode]')
            const editModeElement = fieldElement.querySelector('[data-inline-edit-edit-mode]')

            if (readMode) {
                readMode.classList.remove('d-none')
            }
            if (editModeElement) {
                // Edit mode container'ı temizle (content'i kaldır)
                editModeElement.innerHTML = ''
                editModeElement.classList.add('d-none')
            }
        }

        // Error mesajını temizle
        this.clearError(fieldElement)

        // Loading state'i temizle
        this.setLoadingState(fieldElement, false)

        // Form element'ini bul (closed event için - kapanmadan önce)
        const editModeForClosed = fieldElement.dataset.inlineEditMode || 'inline'
        let formElement = null
        if (editModeForClosed === 'popup') {
            // Popover kapanmadan önce form element'ini bul
            const popoverElement = document.querySelector('.popover')
            if (popoverElement) {
                formElement = popoverElement.querySelector('[data-inline-edit-input]')
            }
        } else {
            const editModeElement = fieldElement.querySelector('[data-inline-edit-edit-mode]')
            if (editModeElement && !editModeElement.classList.contains('d-none')) {
                formElement = editModeElement.querySelector('[data-inline-edit-input]')
            }
        }

        // Aktif field'ı temizle
        if (this.activeField === fieldElement) {
            this.activeField = null
            this.activeFieldData = null
        }

        // Event emit: closed
        this.emit('closed', {
            field: fieldElement,
            fieldData: this.activeFieldData,
            formElement: formElement,
            reason: reason
        })
    }

    /**
     * DOM'u günceller (başarılı response sonrası)
     */
    updateDOM(value, fieldElement, providedDisplayValue = null) {
        // HTML type'ı kontrol et (date için format değiştir)
        const htmlType = fieldElement.dataset.inlineEditHtmlType || 'text'
        let displayValue = providedDisplayValue !== null ? providedDisplayValue : value

        // Display value'yu formatla
        if (providedDisplayValue === null) {
            displayValue = this.formatDisplayValue(value, htmlType)
        }

        // Editable target'ı güncelle
        this.updateEditableElement(fieldElement, displayValue)

        // Original value'yu güncelle
        this.updateFieldValue(fieldElement, value)

        // Input value'yu güncelle (bir sonraki edit için - raw value)
        // Template içindeki input değerini güncelle
        const contentTemplate = fieldElement.querySelector('[data-inline-edit-content-template]')
        if (contentTemplate) {
            // Template content'ini bir div'e koy
            const tempDiv = document.createElement('div')
            tempDiv.innerHTML = contentTemplate.innerHTML
            
            // Input'u bul ve değeri güncelle
            const input = tempDiv.querySelector('[data-inline-edit-input]')
            if (input) {
                this.setInputValue(input, value)
                
                // Select elementleri için selected attribute'larını ekle
                if (input.tagName === 'SELECT') {
                    Array.from(input.options).forEach(option => {
                        if (option.selected) {
                            option.setAttribute('selected', 'selected')
                        } else {
                            option.removeAttribute('selected')
                        }
                    })
                }
            }
            
            // Güncellenmiş HTML'i template'e geri kaydet
            contentTemplate.innerHTML = tempDiv.innerHTML
        }
        
        // Inline modu için edit mode içindeki input'u da güncelle (eğer açıksa)
        const editMode = fieldElement.dataset.inlineEditMode || 'inline'
        if (editMode === 'inline') {
            const editModeElement = fieldElement.querySelector('[data-inline-edit-edit-mode]')
            if (editModeElement && !editModeElement.classList.contains('d-none')) {
                const input = editModeElement.querySelector('[data-inline-edit-input]')
                if (input) {
                    this.setInputValue(input, value)
                }
            }
        }
    }

    /**
     * Error mesajını gösterir
     */
    showError(fieldElement, message) {
        const editMode = fieldElement.dataset.inlineEditMode || 'inline'
        
        // Popover modu için popover içindeki elementleri bul
        if (editMode === 'popup') {
            const popoverElement = document.querySelector('.popover')
            if (popoverElement) {
                const errorMessage = popoverElement.querySelector('[data-inline-edit-error]')
                if (errorMessage) {
                    errorMessage.textContent = message
                    errorMessage.classList.add('d-block')
                }

                const input = popoverElement.querySelector('[data-inline-edit-input]')
                if (input) {
                    input.classList.add('is-invalid')
                }
            }
        } else {
            // Inline modu için mevcut işlem
            const errorMessage = fieldElement.querySelector('[data-inline-edit-error]')
            if (errorMessage) {
                errorMessage.textContent = message
                errorMessage.classList.add('d-block')
            }

            const input = fieldElement.querySelector('[data-inline-edit-input]')
            if (input) {
                input.classList.add('is-invalid')
            }
        }
    }

    /**
     * Error mesajını temizler
     */
    clearError(fieldElement) {
        const editMode = fieldElement.dataset.inlineEditMode || 'inline'
        
        // Popover modu için popover içindeki elementleri bul
        if (editMode === 'popup') {
            const popoverElement = document.querySelector('.popover')
            if (popoverElement) {
                const errorMessage = popoverElement.querySelector('[data-inline-edit-error]')
                if (errorMessage) {
                    errorMessage.textContent = ''
                    errorMessage.classList.remove('d-block')
                }

                const input = popoverElement.querySelector('[data-inline-edit-input]')
                if (input) {
                    input.classList.remove('is-invalid')
                }
            }
        } else {
            // Inline modu için mevcut işlem
            const errorMessage = fieldElement.querySelector('[data-inline-edit-error]')
            if (errorMessage) {
                errorMessage.textContent = ''
                errorMessage.classList.remove('d-block')
            }

            const input = fieldElement.querySelector('[data-inline-edit-input]')
            if (input) {
                input.classList.remove('is-invalid')
            }
        }
    }

    /**
     * Loading state'i ayarlar
     */
    setLoadingState(fieldElement, isLoading) {
        const editMode = fieldElement.dataset.inlineEditMode || 'inline'
        
        // Popover modu için popover içindeki elementleri bul
        if (editMode === 'popup') {
            const popoverElement = document.querySelector('.popover')
            if (popoverElement) {
                const input = popoverElement.querySelector('[data-inline-edit-input]')
                if (input) {
                    input.disabled = isLoading
                }

                const saveButton = popoverElement.querySelector('[data-inline-edit-save]')
                if (saveButton) {
                    saveButton.disabled = isLoading
                    if (isLoading) {
                        saveButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span>'
                    } else {
                        saveButton.innerHTML = '<i class="ri-check-line"></i>'
                    }
                }

                const cancelButton = popoverElement.querySelector('[data-inline-edit-cancel]')
                if (cancelButton) {
                    cancelButton.disabled = isLoading
                }
            }
        } else {
            // Inline modu için mevcut işlem
            const input = fieldElement.querySelector('[data-inline-edit-input]')
            if (input) {
                input.disabled = isLoading
            }

            const saveButton = fieldElement.querySelector('[data-inline-edit-save]')
            if (saveButton) {
                saveButton.disabled = isLoading
                if (isLoading) {
                    saveButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span>'
                } else {
                    saveButton.innerHTML = '<i class="ri-check-line"></i>'
                }
            }

            const cancelButton = fieldElement.querySelector('[data-inline-edit-cancel]')
            if (cancelButton) {
                cancelButton.disabled = isLoading
            }
        }
    }

    /**
     * Response'dan error mesajını çıkarır ve field-specific hataları bulur
     */
    extractErrorMessage(data, fieldElement) {
        const fieldPath = fieldElement?.dataset?.inlineEditFieldPath || ''
        
        // 1. Field-specific hatayı ara
        if (fieldPath && data.errors && typeof data.errors === 'object') {
            const fieldError = this.getNestedError(data.errors, fieldPath.split('.'))
            if (fieldError) {
                return fieldError
            }
        }
        
        // 2. İlk genel hata mesajını al
        if (data.errors && typeof data.errors === 'object') {
            const firstError = this.extractFirstError(data.errors)
            if (firstError) {
                return firstError
            }
        }
        
        // 3. Ana mesajı kullan
        if (data.message) {
            return data.message
        }
        
        // 4. Fallback
        return 'Bir hata oluştu. Lütfen tekrar deneyin.'
    }

    /**
     * Nested error object'inden belirli path'e göre hatayı bulur
     */
    getNestedError(errors, pathParts) {
        let current = errors
        
        for (const part of pathParts) {
            if (current && typeof current === 'object' && current[part]) {
                current = current[part]
            } else {
                return null
            }
        }
        
        return this.extractFirstError(current)
    }

    /**
     * Error object'inden ilk hatayı çıkarır (array, string veya nested object)
     */
    extractFirstError(error) {
        if (Array.isArray(error) && error.length > 0) {
            return error[0]
        }
        
        if (typeof error === 'string') {
            return error
        }
        
        if (typeof error === 'object') {
            const firstNestedError = Object.values(error)[0]
            return this.extractFirstError(firstNestedError)
        }
        
        return null
    }

    /**
     * Değeri karşılaştırma için normalize eder
     */
    normalizeValueForComparison(value) {
        if (Array.isArray(value)) {
            return value.join(',')
        }
        if (typeof value === 'string') {
            return value.trim()
        }
        return String(value)
    }

    /**
     * Display value'yu formatlar
     */
    formatDisplayValue(value, htmlType) {
        let displayValue = value

        // Array değerler için string'e çevir
        if (Array.isArray(value)) {
            displayValue = value.join(',')
        }

        // Date formatı: YYYY-MM-DD -> DD.MM.YYYY
        if (htmlType === 'date' && displayValue && !Array.isArray(displayValue)) {
            try {
                const dateMatch = String(displayValue).match(/^(\d{4})-(\d{2})-(\d{2})$/)
                if (dateMatch) {
                    const [, year, month, day] = dateMatch
                    displayValue = `${day}.${month}.${year}`
                }
            } catch (e) {
                // Date parse hatası, original value'yu kullan
            }
        }

        return displayValue
    }

    /**
     * Editable element'i günceller
     */
    updateEditableElement(fieldElement, displayValue) {
        const editable = fieldElement.querySelector('[data-inline-edit-editable]')
        if (!editable) {
            return
        }

        let textValue
        if (Array.isArray(displayValue)) {
            textValue = displayValue.join(', ')
        } else if (displayValue !== null && displayValue !== undefined) {
            textValue = String(displayValue)
        } else {
            textValue = '-'
        }
        editable.textContent = textValue
    }

    /**
     * Field value'yu günceller (data attribute ve activeFieldData)
     */
    updateFieldValue(fieldElement, value) {
        if (!this.activeFieldData) {
            return
        }

        this.activeFieldData.originalValue = value
        const valueForAttribute = Array.isArray(value) ? value.join(',') : value
        fieldElement.dataset.inlineEditValue = valueForAttribute
    }

    /**
     * Input element'ine değeri set eder (select, input, textarea desteği)
     */
    setInputValue(input, value) {
        if (input.tagName === 'SELECT') {
            const isMultiple = input.hasAttribute('multiple')
            
            // Önce tüm option'ları seçili olmaktan çıkar
            Array.from(input.options).forEach(option => {
                option.selected = false
            })
            
            if (value) {
                // Value virgülle ayrılmış string olabilir (multiple için) veya tek değer
                const values = isMultiple && String(value).includes(',') 
                    ? String(value).split(',').map(v => v.trim()).filter(v => v)
                    : [String(value).trim()].filter(v => v)
                
                // Her bir değer için ilgili option'ı seçili yap
                values.forEach(val => {
                    const option = Array.from(input.options).find(opt => opt.value === val)
                    if (option) {
                        option.selected = true
                    }
                })
            }
        } else {
            // Input veya textarea için normal value set
            input.value = value
            
            // Input için attribute'u da set et (textarea için gerekli değil)
            if (input.tagName === 'INPUT') {
                input.setAttribute('value', value)
            }
            
            // Input event'i tetikle (bazı framework'ler için gerekli olabilir)
            // input.dispatchEvent(new Event('input', { bubbles: true }))
        }
    }

    /**
     * Input element'inden değeri alır (select, input, textarea desteği)
     */
    getInputValue(input) {
        if (input.tagName === 'SELECT') {
            const isMultiple = input.hasAttribute('multiple')
            
            if (isMultiple) {
                const selectedOptions = Array.from(input.selectedOptions || input.options).filter(opt => opt.selected)
                return {
                    value: selectedOptions.map(opt => opt.value),
                    isMultiple: true,
                    selectedTexts: selectedOptions.map(opt => opt.textContent.trim())
                }
            } else {
                const selectedOption = input.options[input.selectedIndex]
                return {
                    value: input.value || '',
                    isMultiple: false,
                    selectedTexts: selectedOption ? selectedOption.textContent.trim() : null
                }
            }
        }
        
        return {
            value: input.value.trim(),
            isMultiple: false,
            selectedTexts: null
        }
    }

    /**
     * Array değerler için query string oluşturur
     */
    buildArrayQueryString(fieldName, values) {
        const encodedFieldName = encodeURIComponent(fieldName + '[]')
        return values.map(v => `${encodedFieldName}=${encodeURIComponent(v)}`).join('&')
    }

    /**
     * CSRF token'ı alır (meta tag'den veya cookie'den)
     */
    getCsrfToken() {
        // Meta tag'den dene
        const metaTag = document.querySelector('meta[name="csrf-token"]')
        if (metaTag) {
            return metaTag.getAttribute('content')
        }

        // Cookie'den dene
        const cookies = document.cookie.split(';')
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=')
            if (name === 'csrf_token' || name === '_token') {
                return decodeURIComponent(value)
            }
        }

        return null
    }
}

// Export for testing and manual initialization
export default InlineEditManager

