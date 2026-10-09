from django.urls import path
from hub import views

urlpatterns = [
    path('chat/', views.chat_view, name='chat'),
    path('chat/new/', views.new_chat_view, name='new_chat'),
    path('api/chat/send/', views.send_message_api, name='send_message_api'),
    path('api/chat/stream/', views.send_message_stream_api, name='send_message_stream_api'),
    path('api/feedback/', views.feedback_api, name='feedback_api'),
    path('documents/', views.documents_view, name='documents'),
    path('documents/upload/', views.document_upload_view, name='document_upload'),
    path('documents/<uuid:doc_id>/retire/', views.document_retire_view, name='document_retire'),
    path('documents/<uuid:doc_id>/rules/', views.document_rules_view, name='document_rules'),
    path('members/', views.members_view, name='members'),
    path('analytics/', views.analytics_view, name='analytics'),
    path('gaps/', views.gaps_view, name='gaps'),
    path('audit/', views.audit_view, name='audit'),
    path('integrations/', views.integrations_view, name='integrations'),
    path('switch-user/', views.switch_user_view, name='switch_user'),
]
