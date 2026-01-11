# VrlInlineEditableBundle

Symfony bundle for inline editing functionality with event-based SDK architecture.

## Özellikler

- **Event-Based SDK**: Dış plugin'lere bağımlı değildir. Event-based sistem kullanır.
- **Twig Functions**: `inline_edit_input`, `inline_edit_textarea`, `inline_edit_select` fonksiyonları
- **Template Override**: Symfony form theme sistemi gibi template override desteği
- **Multiple Select Support**: Array formatında veri gönderimi
- **Form Validation**: Backend validation error'larını gösterir

## Kurulum

```bash
composer require vrl/inline-editable-bundle
```

## Yapılandırma

`config/packages/inline_edit.yaml`:

```yaml
inline_editable:
    themes: []
```

Template override için `themes` dizisine override path'lerinizi ekleyebilirsiniz.

## Kullanım

### Twig Functions

#### Input

```twig
{{ inline_edit_input({
    'value': personel.name,
    'editFieldFormName': 'personel.name',
    'url': path('app_personel_update', {'id': personel.id}),
    'htmlType': 'text',
    'placeholder': 'Ad giriniz'
}) }}
```

#### Textarea

```twig
{{ inline_edit_textarea({
    'value': personel.address,
    'editFieldFormName': 'personel.address',
    'url': path('app_personel_update', {'id': personel.id}),
    'placeholder': 'Adres giriniz'
}) }}
```

#### Select

```twig
{{ inline_edit_select({
    'data': departmanlar,
    'selected_data': secilidepartanIds,
    'choice_label_key': 'baslik',
    'choice_value_key': 'id',
    'editFieldFormName': 'departmanlar',
    'url': path('app_personel_update', {'id': personel.id}),
    'multiple': true,
    'placeholder': 'Departman seçiniz',
    'displayValue': secilidepartanBasliklar|join(', ') ?: '-',
    'attr': {
        'data-choices': 'true',
        'data-choices-removeItem': 'true'
    }
}) }}
```

## Event-Based SDK Kullanımı

Bundle event-based bir SDK olarak çalışır. Dış plugin'leri (Choices.js gibi) yönetmek için event'leri dinleyebilirsiniz.

### Global Instance

```javascript
// assets/app.js
import '../vendor/vrl/inline-editable-bundle/assets/inline_edit_manager.js'

// Global instance
window.inlineEditManager = new InlineEditManager()
```

### Event'leri Dinleme

```javascript
// Event listener ekleme
inlineEditManager.on('opened', (data) => {
    // Edit mode açıldığında
    const { field, fieldData, input } = data
    
    // Choices.js gibi plugin'leri burada initialize edebilirsiniz
    if (input && input.hasAttribute('data-choices')) {
        const choicesInstance = new Choices(input, {
            // Choices.js config
        })
        // Instance'ı saklayın (field veya input'a ekleyebilirsiniz)
        input._choicesInstance = choicesInstance
    }
})

inlineEditManager.on('save', (data) => {
    // Save başlamadan önce
    const { field, value, input } = data
    
    // Choices.js dropdown'ı kapatabilirsiniz
    if (input && input._choicesInstance) {
        if (input._choicesInstance.dropdown?.isActive) {
            input._choicesInstance.hideDropdown(true)
        }
    }
})

inlineEditManager.on('cancel', (data) => {
    // Cancel edildiğinde
    const { field, input, originalValue } = data
    
    // Choices.js değerlerini reset edebilirsiniz
    if (input && input._choicesInstance) {
        // Orijinal değerlere reset et
        const valuesToSet = originalValue.includes(',') 
            ? originalValue.split(',').map(v => v.trim()).filter(v => v)
            : originalValue.trim()
        
        if (input._choicesInstance.setValueByChoice) {
            input._choicesInstance.setValueByChoice(valuesToSet, true)
        }
    }
})

inlineEditManager.on('saved', (data) => {
    // Save başarılı olduğunda
    const { field, value, displayValue } = data
    console.log('Saved:', value)
})

inlineEditManager.on('error', (data) => {
    // Hata oluştuğunda
    const { field, error, action } = data
    console.error('Error:', error)
})
```

### Event Listesi

- **`opened`**: Edit mode açıldığında emit edilir
  - `field`: Field container elementi
  - `fieldData`: Field data objesi
  - `input`: Input elementi

- **`clicked`**: Edit butonuna tıklandığında emit edilir
  - `field`: Field container elementi
  - `fieldData`: Field data objesi
  - `input`: Input elementi

- **`save`**: Save işlemi başlamadan önce emit edilir
  - `field`: Field container elementi
  - `fieldData`: Field data objesi
  - `value`: Yeni değer (array olabilir multiple select için)
  - `isMultiple`: Multiple select mi?
  - `input`: Input elementi
  - `preventDefault`: Event'i iptal etmek için (kullanılmıyor şu an)

- **`saved`**: Save işlemi başarıyla tamamlandığında emit edilir
  - `field`: Field container elementi
  - `fieldData`: Field data objesi
  - `value`: Kaydedilen değer
  - `displayValue`: Görüntülenen değer (select için option text'leri)
  - `response`: Server response

- **`cancel`**: Cancel işlemi yapıldığında emit edilir
  - `field`: Field container elementi
  - `fieldData`: Field data objesi
  - `input`: Input elementi
  - `originalValue`: Orijinal değer

- **`rejected`**: Cancel işlemi yapıldığında emit edilir (alias)
  - `field`: Field container elementi
  - `fieldData`: Field data objesi
  - `input`: Input elementi
  - `originalValue`: Orijinal değer

- **`error`**: Hata oluştuğunda emit edilir
  - `field`: Field container elementi
  - `fieldData`: Field data objesi
  - `error`: Hata mesajı veya error objesi
  - `action`: Hangi işlemde hata oluştu ('save', 'cancel', vs.)
  - `response`: Server response (varsa)

## API

### `on(eventName, callback)`

Event listener ekler.

```javascript
inlineEditManager.on('opened', (data) => {
    // Event handler
})
```

### `off(eventName, callback)`

Event listener kaldırır.

```javascript
const handler = (data) => { /* ... */ }
inlineEditManager.on('opened', handler)
inlineEditManager.off('opened', handler)
```

## Template Override

`config/packages/inline_edit.yaml`:

```yaml
inline_editable:
    themes:
        - 'inline_edit/custom_input.html.twig'
        - 'inline_edit/custom_select.html.twig'
```

Override template'leriniz `templates/inline_edit/` dizinine eklenmelidir.

## Gereksinimler

- PHP 8.1+
- Symfony 7.4+
- Twig 3.0+
