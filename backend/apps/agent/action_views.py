from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .actions import create_add_part_draft, execute_confirmed_action


class AgentAddPartDraftView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        visit_id = request.data.get('visit_id')
        offer = request.data.get('offer')
        quantity = request.data.get('quantity', 1)
        sell_price = request.data.get('sell_price')
        try:
            action = create_add_part_draft(
                request.user,
                visit_id=visit_id,
                offer=offer,
                quantity=quantity,
                sell_price=sell_price,
            )
        except (PermissionError, PermissionDenied) as exc:
            detail = exc.detail if hasattr(exc, 'detail') else str(exc)
            return Response({'detail': str(detail)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'id': action.id,
            'status': action.status,
            'summary_text': action.summary_text,
            'expires_at': action.expires_at,
        }, status=status.HTTP_201_CREATED)


class AgentExecuteActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, action_id):
        try:
            result = execute_confirmed_action(request.user, action_id)
        except (PermissionError, PermissionDenied) as exc:
            detail = exc.detail if hasattr(exc, 'detail') else str(exc)
            return Response({'detail': str(detail)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)
