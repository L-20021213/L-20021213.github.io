/* 刷新缓存 */
function refreshCache() {
    if ('serviceWorker' in window.navigator && navigator.serviceWorker.controller) {
        if (confirm('是否确定刷新博文缓存')) navigator.serviceWorker.controller.postMessage("refresh")
    } else if (GLOBAL_CONFIG.Snackbar) {
        btf.snackbarShow('ServiceWorker未激活')
    } else {
        alert('ServiceWorker未激活')
    }
}

navigator.serviceWorker.addEventListener('message', event => {
    if (event.data === 'success') location.reload(true)
})

/* 主页欢迎弹窗(老)，特点，指定页面弹出，刷新就弹 */
/* if(window.location.href == 'http://localhost:4000/'||window.location.href == 'https://sianx.com/'||window.location.href == 'https://www.sianx.com/'||window.location.href == 'https://blog.sianx.com/'){
    Snackbar.show({ actionText: '关闭',text: '欢迎来到丨浅笑安然丨的小站！',backgroundColor: '#9c9',actionTextColor: '#ffffff',pos: 'bottom-center',duration: '2000' });
  } */
/* 结合套娃版，打开一次浏览器只弹出一次，锁定主页 */
if(window.location.href == 'http://localhost:4000/'||window.location.href == 'https://sianx.com/'||window.location.href == 'https://www.sianx.com/'||window.location.href == 'https://blog.sianx.com/'){
    if(window.name == ""){
        window.name = "hytc";  // 在首次进入页面时我们可以给window.name设置一个固定值 
        Snackbar.show({ 
            text: '欢迎来到丨浅笑安然丨的小站！',
            actionText: '关闭',
            actionTextColor: '#ffffff',
            pos: 'bottom-center',
            duration: '2000' });
      }
  }

/* 按F12关闭当前网页或转跳，禁止右键，禁止保存网页 */
//禁止F12
function fuckyou(){
    window.close(); //关闭当前窗口(防抽)
    window.location="about:blank"; //将当前窗口跳转置空白页
    }
    function click(e) {
    if (document.all) {
      if (event.button==2||event.button==3) { 
    alert("欢迎光临，有什么需要帮忙的话，请与站长联系！谢谢您的合作！！！");
    oncontextmenu='return false';
    }
    }
    if (document.layers) {
    if (e.which == 3) {
    oncontextmenu='return false';
    }
    }
    }
    if (document.layers) {
    fuckyou();
    document.captureEvents(Event.MOUSEDOWN);
    }
    document.onmousedown=click;
    document.oncontextmenu = new Function("return false;")
    document.onkeydown =document.onkeyup = document.onkeypress=function(){ 
    if(window.event.keyCode == 123) { 
    fuckyou();
    window.event.returnValue=false;
    return(false); 
    } 
    }
    //禁用CTRL+S
    $(document).keydown(function(e){
       if( e.ctrlKey  == true && e.keyCode == 83 ){
          console.log('ctrl+s');
          return false; // 截取返回false就不会保存网页了
       }
    });

/* 打开控制台无限debugger，以加进layout.pug，博客框架 */
/* ((function() {
    var callbacks = [],
        timeLimit = 50,
        open = false;
    setInterval(loop, 1);
    return {
        addListener: function(fn) {
            callbacks.push(fn);
        },
        cancleListenr: function(fn) {
            callbacks = callbacks.filter(function(v) {
                return v !== fn;
            });
        }
    }

    function loop() {
        var startTime = new Date();
        debugger;
        if (new Date() - startTime > timeLimit) {
            if (!open) {
                callbacks.forEach(function(fn) {
                    fn.call(null);
                });
            }
            open = true;
            window.stop();
            alert('大佬别扒了！');
            document.body.innerHTML = "";
        } else {
            open = false;
        }
    }
})()).addListener(function() {
    window.location.reload();
}); */
/* 效果同上，以加进layout.pug，博客框架 */
/*  
  setInterval(() => {
    (function (a) {return (function (a) {return (Function('Function(arguments[0]+"' + a + '")()'))})(a)})('bugger')('de', 0, 0, (0, 0));
  }, 1000);
  */
