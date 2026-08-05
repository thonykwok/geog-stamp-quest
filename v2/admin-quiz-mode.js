(function(){
  function inject(){
    if(document.getElementById('s-quizMode')) return;
    var form = document.getElementById('s-txtReplay');
    if(!form){ setTimeout(inject,200); return; }
    var wrap = document.createElement('div');
    wrap.className = 'sm:col-span-2 border-t pt-3 mt-1';
    wrap.innerHTML = '<label class="text-xs text-slate-500 font-medium">\u7b54\u984c\u6a21\u5f0f</label>'+
      '<select id="s-quizMode" class="w-full border rounded-lg px-2.5 py-1.5 text-sm mt-1">'+
      '<option value="retry">\u53ef\u91cd\u8a66\uff1a\u7b54\u932f\u53ef\u518d\u64c7\uff0c\u5168\u5c0d\u5148\u84cb\u5370</option>'+
      '<option value="oneshot">\u4e00\u6b21\u904e\uff1a\u7b54\u932f\u5373\u4e0b\u4e00\u984c\uff0c\u4e0d\u53ef\u91cd\u9078\uff1b\u5168\u5c0d\u5148\u84cb\u5370</option></select>'+
      '<p class="text-xs text-slate-400 mt-1">\u4e00\u6b21\u904e\u6a21\u5f0f\uff1a\u8d70\u5b8c\u6240\u6709\u7ad9\u5f8c\u986f\u793a\u660e\u4fe1\u7247\uff0c\u53ea\u6709\u5168\u5c0d\u5605\u7ad9\u6709\u5370\u3002</p>';
    form.parentElement.parentElement.appendChild(wrap);
    setTimeout(function(){
      var s = (window.programMeta && programMeta.settings) || {};
      var el = document.getElementById('s-quizMode');
      if(el) el.value = s.quizMode || 'retry';
    }, 800);
    if(typeof window.readSettingsForm === 'function'){
      var _r = window.readSettingsForm;
      window.readSettingsForm = function(){
        var o = _r();
        var el = document.getElementById('s-quizMode');
        o.quizMode = el ? el.value : 'retry';
        return o;
      };
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
