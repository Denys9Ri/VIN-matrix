from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .parts_agent import search_analogs, search_original, search_selected_analog
from .services import get_company_or_raise, write_audit


class AgentOriginalArticleSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        article = str(request.data.get('article') or '').strip()
        try:
            offers = search_original(request.user, article)
        except PermissionError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        company = get_company_or_raise(request.user)
        write_audit(
            company=company,
            user=request.user,
            request_text=article,
            recognized_intent='search_original_article',
            tool_name='parts.search_original',
            tool_input={'article': article},
            tool_result={'count': len(offers)},
        )
        return Response({'article': article, 'count': len(offers), 'offers': offers})


class AgentAnalogSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        original_offer = request.data.get('original_offer')
        if not isinstance(original_offer, dict):
            return Response(
                {'detail': 'Передайте original_offer з результату пошуку оригіналу.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            offers = search_analogs(request.user, original_offer)
        except PermissionError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        company = get_company_or_raise(request.user)
        write_audit(
            company=company,
            user=request.user,
            recognized_intent='search_analogs',
            tool_name='parts.search_analogs',
            tool_input={
                'article': original_offer.get('article', ''),
                'supplier_id': original_offer.get('supplier_id'),
            },
            tool_result={'count': len(offers)},
        )
        return Response({'count': len(offers), 'offers': offers})


class AgentSelectedAnalogSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        article = str(request.data.get('article') or '').strip()
        brand = str(request.data.get('brand') or '').strip()
        try:
            offers = search_selected_analog(request.user, article, brand)
        except PermissionError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        company = get_company_or_raise(request.user)
        write_audit(
            company=company,
            user=request.user,
            recognized_intent='search_selected_analog',
            tool_name='parts.search_selected_analog',
            tool_input={'article': article, 'brand': brand},
            tool_result={'count': len(offers)},
        )
        return Response({'article': article, 'brand': brand, 'count': len(offers), 'offers': offers})
