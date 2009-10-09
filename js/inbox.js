var api = null;
var last_check;
var offset = {0: 0, 1: 0, 4: 0};
var limit = 20;
var rowStatus = {};
var months = {0: "January", 1: "February", 2: "March", 3: "April", 4: "May", 
              5: "June", 6: "July", 7: "August", 8: "September", 9: "October",
              10: "November", 11: "December"};
var namesToUids = {};
var logging_in = false;
var userInfo = {};
var currentFolder = 0;

function login() {
  if(logging_in) {
    return;
  } else {
    logging_in = true;
  }
  api = FB.Facebook.apiClient;
  $("#loginbutton").hide();
  $("#controls").show();
  $("#showall").bind("click", showAll);
  $("#showunread").bind("click", showUnread);
  $("#showread").bind("click", showRead);
  $("#showinbox").bind("click", showInbox);
  $("#showoutbox").bind("click", showOutbox);
  $("#showupdates").bind("click", showUpdates);
  $("#searchbox").bind("click", clearSearch)
                 .bind("keypress", function(e) { 
                   if(e.keyCode == 13) searchThreads();
                 });
  $("#create_thread").bind("click", createThread);
  var params = {'ext_perm': 'manage_mailbox'};
  api.callMethod('users.hasAppPermission', params, function(result, ex) {
    if(result != 1) {
      FB.Connect.showPermissionDialog("manage_mailbox", function(result) { 
                                                        getMoreRows(); 
                                                      });
    } else {
      getMoreRows();
    }
  });
  last_check = new Date();
  $("html").everyTime(30000, getMoreRecentRows); 
  params = {'query': "SELECT uid, name FROM user WHERE uid IN (SELECT uid1 " +
                     "FROM friend WHERE uid2 = "+api.get_session().uid+")"};
  api.callMethod('fql.query', params, function(result, ex) { 
    for(var i = 0; i < result.length; i++) {
      namesToUids[result[i]['name']] = result[i]['uid'];
    }
  });
  params = {'query': "SELECT url, name, pic_square FROM profile WHERE id = "+api.get_session().uid};
  api.callMethod('fql.query', params, function(r, e) {
      namesToUids[r[0]['name']] = api.get_session().uid;
      userInfo[api.get_session().uid] = r[0];
  });
  updateUnreadCounts();
}

function updateUnreadCounts() {
  params = {'query': "SELECT unread_count, folder_id FROM mailbox_folder WHERE viewer_id = "+api.get_session().uid};
  api.callMethod('fql.query', params, function(r, e) {
      for(var i = 0; i < r.length; i++) {
        if(r[i]['folder_id'] == 0) {
          $("#showinbox .unread_count .num").html(r[i]['unread_count']);
        }
        if(r[i]['folder_id'] == 1) {
          $("#showoutbox .unread_count .num").html(r[i]['unread_count']);
        }
        if(r[i]['folder_id'] == 4) {
          $("#showupdates .unread_count .num").html(r[i]['unread_count']);
        }
    }
  });
}

function getMoreRows() {
  var params = {'queries': '{"threads": "SELECT object_id, thread_id, snippet,'+
                            'snippet_author, updated_time, unread, subject, folder_id FROM'+
                            ' thread WHERE folder_id = '+currentFolder+' LIMIT '+offset[currentFolder]+', '+
                            limit+'",' +
                            '"users": "SELECT url, id, pic_square, name FROM'+
                            ' profile WHERE id IN (SELECT snippet_author,'+ 
                            ' object_id FROM #threads)"}'};
  offset[currentFolder] = offset[currentFolder] + limit;
  api.callMethod('fql.multiquery', params, function(result, ex) {
    var threads = result[0]['fql_result_set'];
    var users = result[1]['fql_result_set'];
    var ids_to_users = {};
    for(var i = 0; i < users.length; i++) {
      //console.log(i);
      ids_to_users[users[i]['id']] = users[i];
    }
    users = ids_to_users;
    for(var j = 0; j < threads.length; j++) {
      addRow(threads[j], users, false);
    }
  });
}

function getMoreRecentRows() {
  var params = {'queries': '{"threads": "SELECT object_id, thread_id, snippet,'+
                            'snippet_author, updated_time, unread, subject, folder_id FROM'+
                            ' thread WHERE updated_time > '
                            +parseInt(last_check.getTime()/1000)
                            +' AND folder_id = '+currentFolder
                            +' ORDER BY updated_time DESC'
                            +' LIMIT '+limit+'",' +
                            '"users": "SELECT url, id, pic_square, name FROM'+
                            ' profile WHERE id IN (SELECT snippet_author,'+ 
                            ' object_id FROM #threads)"}'};
  offset[currentFolder] = offset[currentFolder] + limit;
  last_check = new Date();
  api.callMethod('fql.multiquery', params, function(result, ex) {
    var threads = result[0]['fql_result_set'];
    var users = result[1]['fql_result_set'];
    var ids_to_users = {};
    for(var i = 0; i < users.length; i++) {
      //console.log(i);
      ids_to_users[users[i]['id']] = users[i];
    }
    users = ids_to_users;
    for(var j = 0; j < threads.length; j++) {
      if($("#"+threads[j]['thread_id']+"_"+currentFolder).length == 0) {
        addRow(threads[j], users, true);
      }
    }
  });
}

function addRow(thread, users, addToTop) {
  var user = null;
  if(thread['object_id'] != 0) {
    user = users[thread['object_id']];
  } else {
    user = users[thread['snippet_author']];
  }
  rowStatus[thread['thread_id']+"_"+currentFolder] = false;
  var row = $("<tr></tr>").addClass('row').addClass('clearfix')
                          .attr("id", thread['thread_id']+"_"+thread['folder_id'])
                          .attr("object_id", thread['object_id'])
                          .attr("folder_id", thread['folder_id']);
  if(thread['unread'] != 0) {
    row.addClass('unread');
  } else {
    row.addClass('read');
  }
  var author = $("<td></td>").addClass('author');
  var author_info = $("<td></td>").addClass('authorinfo');
  var profile_pic = $("<img></img>").addClass('pic')
                    .attr("src", user['pic_square']);
  var name = $("<a></a>").addClass('name');
  name.attr("href", user['url']);
  name.append(user['name']);
  author.append(profile_pic);
  author_info.append(name);

  var date = new Date(thread['updated_time'] * 1000);
  var time = $("<div></div>").addClass('time')
             .append(months[date.getMonth()])
             .append(" " + date.getDate() + " at ");
  var hours = date.getHours();
  var minutes = date.getMinutes();
  if(hours > 12) {
    hours = hours - 12;
  }
  if(hours == 0) {
    hours = 12;
  }
  if(minutes < 10) {
    minutes = "0" + minutes;
  }
  time.append(hours + ":" + minutes);
  if(hours > 11) {
    time.append("am");
  } else {
    time.append("pm");
  }
  author_info.append(time);

  var threadinfo = $("<td></td>").addClass('threadinfo');
  var wrap = $("<div></div>").addClass('wrap');
  var actions = $("<ul class='hoveractions'></ul>");
  if(thread['unread'] != 0) {
    readaction = $("<a>mark read</a>").toggle(markRead, markUnread)
                 .bind("click", function(e) { e.stopPropagation(); });
    actions.append($("<li class='hoveraction'></li>").append(readaction));
  } else {
    unreadaction = $("<a>mark unread</a>").toggle(markUnread, markRead)
                   .bind("click", function(e) { e.stopPropagation(); });
    actions.append($("<li class='hoveraction'></li>").append(unreadaction));        
  }
  var delaction = $("<a>delete</a>").bind("click", deleteThread)
                  .bind("click", function(e) { e.stopPropagation(); });
  actions.append($("<li class='hoveraction last'></li>").append(delaction));
  
  var subject = $("<div></div>").addClass('subject').append(thread['subject']);
  var snippet = $("<div></div>").addClass('snippet').append(thread['snippet']);

  wrap.append(actions).append(subject).append(snippet);
  threadinfo.append(wrap);
  row.append(author).append(author_info).append(threadinfo);
  if(thread['folder_id'] != currentFolder) {
    row.hide();
  }
  if(!addToTop) {
    $("#inbox").append(row);
  } else {
    $("#inbox").prepend(row);
  }
  row.bind("click", showRow);
}

function showRow() {
  var row = $(this);
  var id = row.attr('id');
  var thread_id = id.split('_')[0];
  if(rowStatus[id]) {
    rowStatus[id] = false;
    $("#"+id+"_messages").slideUp("fast");
  } else {
    if(row.hasClass('unread')) {
      row.find('.hoveractions > li').children().filter("a:contains('read')").click();
    } 
    rowStatus[id] = true;
    var current_ext = $("#"+id+"_messages");
    if(current_ext.length > 0) {
      current_ext.slideDown("fast");
      return;
    }
    var params = {};
    params['queries'] = '{"messages": "SELECT attachment, thread_id,'+
                          ' message_id, body, created_time, author_id FROM'+
                          ' message WHERE thread_id = '+thread_id+'",';
    if(row.attr('object_id') != 0) {
      params['queries'] += '"users": "SELECT url, id, pic_square, name FROM'+
                           ' profile WHERE id IN (SELECT author_id FROM'+
                           ' #messages) OR id='+row.attr('object_id')+'"}';
    } else {
      params['queries'] += '"users": "SELECT url, id, pic_square, name FROM'+
                           ' profile WHERE id IN (SELECT author_id FROM'+
                           ' #messages)"}';
    }
    api.callMethod('fql.multiquery', params, function(result, ex) {
      var messages = result[0]['fql_result_set'];
      var users = result[1]['fql_result_set'];
      var thread_id = messages[0]['thread_id'];
      var row = $("#"+thread_id+"_"+currentFolder);
      var id = row.attr('id');
      var messages_table = $("<table></table>").addClass("messages_table");
      var messages_col = $("<td></td");
      var messages_row = $("<tr></tr>")
                        .attr("id", id+"_messages")
                        .addClass('messages');
      var ids_to_users = {};
      for(var i = 0; i < users.length; i++) {
        ids_to_users[users[i]['id']] = users[i];
      }
      users = ids_to_users;
      for(var j = 0; j < messages.length; j++) {
        var message_row = $("<tr></tr>").addClass('message');
        var message_info = $("<td></td>").addClass('message_pic');
        //console.log(messages[j]['attachment']);
        var uid = messages[j]['author_id'];
        if(typeof(row.attr('object_id')) != "undefined" && row.attr('object_id') != 0) {
          uid = row.attr('object_id');
        }
        var img = $("<img></img>").attr('src', users[uid]['pic_square']).addClass('pic');
        message_info.append(img);
        message_row.append(message_info);

        var message_body = $("<td></td>").addClass('message_body');
        message_data = $("<div></div").addClass('message_data');
        message_data.append("<a class='message_author' href='"+users[uid]['url']+"'>"+users[uid]['name']+"</a>");
        var time = $("<span></span>").addClass('message_time');
        var date = new Date(messages[j]['created_time'] * 1000);
        time.append(months[date.getMonth()]);
        time.append(" " + date.getDate() + " at ");
        var t = "am";
        var hours = date.getHours();
        var minutes = date.getMinutes();
        if (hours > 11) {
          t = "pm";
        }
        if(hours > 12) {
          hours = hours - 12;
        }
        if(hours == 0) {
          hours = 12;
        }
        if(minutes < 10) {
          minutes = "0" + minutes;
        }
        time.append(hours + ":" + minutes+t);
        message_data.append(time);
        message_body.append(message_data);
        var body = messages[j]['body'];
        body = body.replace(/\n/g, "<br />");
        var attch = messages[j]['attachment'];
        var body = $("<div></div>").addClass('body').append(jQuery.trim(body)).append("<br />");
        var hasAttch = false;
        for(var wtf in attch) {
          hasAttch = true;
        }
        if(hasAttch) {
          var attch_div = $("<div></div>").addClass('attachment');
          attch_div.append($("<a href='"+attch['href']+"' class='attch_name'></a>").append(attch['name']));
          attch_div.append($("<div class='attch_caption'></a>").append(attch['caption']));
          attch_div.append($("<div class='attch_desc'></a>").append(attch['description']));
          var has_media = false;
          for(var wtf in attch['media']) {
            has_media = true;
          }
          if(has_media) {
            var url = attch['media'][0]['src'];
            attch_div.append($("<a href='"+attch['media'][0]['href']+
                               "' class='attch_media clearfix'></a>")
                             .append($("<img src='"+attch['media'][0]['src']+"' />")));
          }
          body.append(attch_div);
        }
        message_body.append(body);
        if(j == messages.length - 1) {
          if(row.attr('object_id') == 0) {
            var actions = $("<span class='actions'></span>");
            var reply = $("<a></a>").addClass('reply').append('Reply');
            actions.append(reply);
            message_body.append(actions);
            reply.bind("click", showReply);
          }
          message_row.addClass('last');
        }
        message_row.append(message_body);
        messages_table.append(message_row);
      }
      messages_col.append(messages_table);
      messages_row.append(messages_col);
      messages_row.hide();
      row.after(messages_row);
      messages_row.slideDown("fast");
    });
  }  
}

function showReply() {
  row = $(this);
  row.hide();
  row = row.parents().filter('.last');
  row.removeClass('last');
  var textarea = $("<label>Body</label><textarea rows='10' cols='60'></textarea>");
  var attch = $("<label>Attachment</label><input type='text' name='attachment' />");
  var button = $("<button class='reply_button' type='button'>Reply</button>");
  button.bind("click", function() {
    sendReply($(this));
  });
  var newrow = $("<tr></tr>").addClass('replyarea').addClass('message')
              .addClass('last').append(textarea).append(attch)
              .append(button).hide();
  row.after(newrow);
  newrow.slideDown("fast");
}

function sendReply(row) {
  row = row.parents().filter('.last');
  row.removeClass('last');
  row = row.parent();
  body = row.find('textarea').val() + "";	
  var attchurl = row.find('input').val() + "";
  row.find('.replyarea').remove();
  var uid = api.get_session().uid;
  var users = userInfo;
  var message_row = $("<tr></tr>").addClass('message').addClass('last');
  var message_info = $("<td></td>").addClass('message_pic');
  var img = $("<img></img>").attr('src', users[uid]['pic_square']).addClass('pic');
  message_info.append(img);
  message_row.append(message_info);

  var message_body = $("<td></td>").addClass('message_body');
  message_data = $("<div></div").addClass('message_data');
  message_data.append("<a class='message_author' href='"+users[uid]['profile_url']+"'>"+users[uid]['name']+"</a>");

  var time = $("<span></span>").addClass('message_time');
  var date = new Date();
  time.append(months[date.getMonth()]);
  time.append(" " + date.getDate() + " at ");
  var t = "am";
  var hours = date.getHours();
  var minutes = date.getMinutes();
  if (hours > 11) {
    t = "pm";
  }
  if(hours > 12) {
    hours = hours - 12;
  }
  if(hours == 0) {
    hours = 12;
  }
  if(minutes < 10) {
    minutes = "0" + minutes;
  }
  time.append(hours + ":" + minutes+t);
  message_data.append(time);
  message_body.append(message_data);
  var msg_body = body + "";
  msg_body = msg_body.replace(/\n/g, "<br />");
  msg_body = $("<div></div>").addClass('body').append(msg_body);
  message_body.append(msg_body);
  message_row.addClass('last');
  message_row.append(message_body);
  row.append(message_row);
  var id = row.parents().filter(".messages").attr('id').replace("_messages", "");
  var thread_id = id.split('_')[0];
  params = {'body': body, 'thread_id': thread_id};
  var attachment = { "name": attchurl, "href": attchurl, "caption": "Attached by Teraboxx",
                     "description": "Ask whoever sent this"};
  //params['attachment'] = attachment;
  params['attachment'] = null;
  api.callMethod('message.replyToThread', params, function(result, ex) {});
}

function showAll() {
  applyFilter($(this), ".row", "NULL");
}

function showUnread() {
  applyFilter($(this), ".unread", ".read");
}

function showRead() {
  applyFilter($(this), ".read", ".unread");
}

function applyFilter(link, show, hide) {
  $(".selected").toggleClass("selected");
  link.addClass("selected");
  $("#inbox").find(show).filter(".row[folder_id="+currentFolder+"]").show();
  $("#inbox").find(hide).filter(".row[folder_id="+currentFolder+"]").hide();
  $("#inbox").find(hide).map(hideMessages);
}


function showInbox() {
    applyFolderFilter($(this), 0);
}

function showOutbox() {
  applyFolderFilter($(this), 1);
}

function showUpdates() {
  applyFolderFilter($(this), 4);
}

function applyFolderFilter(link, show) {
  $(".folder_selected").toggleClass("folder_selected");
  link.addClass("folder_selected"); 
  currentFolder = show;
  $("#inbox .row[folder_id="+show+"]").show();
  $("#inbox .row[folder_id!="+show+"]").hide();
  $("#inbox .row[folder_id!="+show+"]").map(hideMessages);
  getMoreRows();
}

function hideMessages(idx, elem) {
  if(rowStatus[$(this).attr('id')]) {
    var id = "#"+$(this).attr('id')+"_messages";
    $(id).hide();
      rowStatus[$(this).attr('id')] = false;
  }
  return id;
}

function searchThreads() {
  var terms = $("#searchbox").val();
  if(terms == "") {
    $("#inbox .row").show();
    return;
  }
  var params = {'queries': 
                '{"threads": "SELECT thread_id FROM thread WHERE'
                 +' CONTAINS(\''+terms+'\')"}'};
  api.callMethod('fql.multiquery', params, function(result, ex) {
    $("#inbox .row").hide();
    var threads = result[0]['fql_result_set'];
    for(key in threads) {
      $("#"+threads[key]['thread_id']+"_"+currentFolder).show();
    }
  });
}

function deleteThread() {
  var link = $(this);
  var row = link.parents().filter(".row");
  var id = row.attr('id');
  var thread_id = id.split('_')[0];
  if(row.next().attr('id') == id+"_messages") {
    row.next().remove();
  }
  row.remove();
  var params = {'thread_id': thread_id};
  api.callMethod('message.deleteThread', params, function(result, ex) {});
}

function clearSearch() {
  if($("#searchbox").val() == "") {
    $("#inbox .row[folder_id="+current_folder+"]").show();
  }
}

function markRead() {
  updateReadStatus($(this), true);
}

function markUnread() {
  updateReadStatus($(this), false);
}

function updateReadStatus(link, status) {
  link.text("mark "+ (status ? "unread" : "read"));
  link.parents().filter(".row").toggleClass('unread').toggleClass('read');
  var thread_id = link.parents().filter(".row").attr('id').split('_')[0];
  var params = {'thread_id': thread_id, 'status': status};
  api.callMethod('message.setThreadReadStatus', params, function(result, ex) {});
  setTimeout('updateUnreadCounts()', 500);
}

function createThread() {
  if($(".create").length == 1) {
    if($(".create").css('display') == "none") {
      $(".create").slideDown("fast");
    } else {
      $(".create").slideUp("fast");
    }        
    return;
  }
  var create = $("<tr></tr>").addClass('create').addClass('row').addClass('clearfix');
  var recipients = $("<input type='text' size='73' name='recipients' />").attr('id', "createRecipients");
  var names = [];
  for(key in  namesToUids) {
    names.push(key);
  }
  recipients.autocomplete(names, {multiple: true, matchContains: true, highlight: null, scroll:false});
  create.append("<label>Recipients</label>").append(recipients);
  var subject = $("<input type='text' name='subject' id='createSubject' />");
  create.append("<label>Subject</label>").append(subject);
  var body = $("<textarea rows='10' cols='73' id='createBody' />");
  create.append("<label>Body</label>").append(body);
  var attch = $("<input type='text' name='attch' id='createAttch' />");
  create.append("<label>Attachment</label>").append(attch);
  var savebutton = $("<button class='sendbtn' type='button'>Save</button>");
  savebutton.bind("click", function() {
    saveThread();
  });
  var button = $("<button class='sendbtn' type='button'>Send</button>");
  button.bind("click", function() {
    sendThread();
  });
  create.append(button).append(savebutton).hide();
  $("#inbox").prepend(create);
  create.slideDown("fast"); 
}

function sendThread() {
  var names = $("#createRecipients").val().split(", ");
  var uids = [];
  for(var i = 0; i < names.length; i++) {
    if(names[i] != "") {
      uids.push(namesToUids[names[i]]);
    }
  }
  var subject = $("#createSubject").val();
  var body = $("#createBody").val();
  var attch = $("#createAttch").val();
  $(".create").remove();
  $("#create_thread").bind("click", createThread);
  var params = {'recipients': uids, 'subject': subject, 'body': body, 
                'attachment': attch};
  var snippet = body.slice(0, 57);
  if(body.length > 57) {
    snippet = snippet + "...";
  }
  
  api.callMethod('message.createThread', params, function(result, ex) {
    var date = new Date;
    unixtime_ms = date.getTime();
    time = parseInt(unixtime_ms / 1000);
    getMoreRecentRows();
  });
}

$(window).scroll(function(){
  if($(window).scrollTop() == $(document).height() - $(window).height()){
    getMoreRows();
  }
});
